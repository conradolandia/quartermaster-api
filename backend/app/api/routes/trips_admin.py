"""Admin trip endpoints (superuser only)."""

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    Boat,
    BoatPublic,
    Trip,
    TripBase,
    TripBoat,
    TripBoatCreate,
    TripBoatPricingCreate,
    TripBoatPublic,
    TripCreate,
    TripCreateFull,
    TripMerchandiseCreate,
    TripPublic,
    TripsPublic,
    TripsWithStatsPublic,
    TripUpdate,
    TripWithStats,
)
from app.services.date_validator import (
    ensure_aware,
    validate_trip_dates,
    validate_trip_time_ordering,
)
from app.services.trip_times import (
    compute_trip_times_from_departure_and_offsets,
    get_default_offsets_for_type,
)

from .trip_utils import trip_to_public

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trips", tags=["trips"])


@router.get(
    "/",
    response_model=TripsWithStatsPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_trips(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    mission_id: uuid.UUID | None = None,
    trip_type: str | None = None,
    include_archived: bool = False,
) -> Any:
    """
    Retrieve trips with booking statistics.
    Optionally filter by mission_id and trip_type (launch_viewing, pre_launch).
    By default exclude archived trips; set include_archived=true to include them.
    """
    trips = crud.get_trips_with_stats(
        session=session,
        skip=skip,
        limit=limit,
        mission_id=mission_id,
        type_=trip_type,
        include_archived=include_archived,
    )
    count = crud.get_trips_count(
        session=session,
        mission_id=mission_id,
        type_=trip_type,
        include_archived=include_archived,
    )
    if trips:
        trip_ids = [t["id"] for t in trips]
        trip_boats_by_trip = crud.get_trip_boats_for_trip_ids(
            session=session, trip_ids=trip_ids
        )
        for t in trips:
            t["effective_booking_mode"] = crud.apply_sales_open_bump_if_needed(
                session=session,
                trip_id=t["id"],
                booking_mode=t.get("booking_mode", "private"),
                sales_open_at=t.get("sales_open_at"),
                trip_dict_to_update=t,
            )
            t["trip_boats"] = [
                TripBoatPublic(
                    id=tb.id,
                    trip_id=tb.trip_id,
                    boat_id=tb.boat_id,
                    max_capacity=tb.max_capacity,
                    use_only_trip_pricing=tb.use_only_trip_pricing,
                    created_at=tb.created_at,
                    updated_at=tb.updated_at,
                    boat=BoatPublic.model_validate(tb.boat),
                )
                for tb in trip_boats_by_trip.get(t["id"], [])
            ]
    return TripsWithStatsPublic(
        data=[TripWithStats.model_validate(t) for t in trips], count=count
    )


@router.post(
    "/",
    response_model=TripPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_trip(
    *,
    session: Session = Depends(deps.get_db),
    trip_in: TripCreate,
) -> Any:
    """
    Create new trip. Departure time plus minute offsets; check-in and boarding times are computed.
    """
    mission = crud.get_mission(session=session, mission_id=trip_in.mission_id)
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission with ID {trip_in.mission_id} not found",
        )
    launch = crud.get_launch(session=session, launch_id=mission.launch_id)
    if not launch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Launch for mission {trip_in.mission_id} not found",
        )

    boarding_min = trip_in.boarding_minutes_before_departure
    checkin_min = trip_in.checkin_minutes_before_boarding
    if boarding_min is None or checkin_min is None:
        default_boarding, default_checkin = get_default_offsets_for_type(trip_in.type)
        if boarding_min is None:
            boarding_min = default_boarding
        if checkin_min is None:
            checkin_min = default_checkin

    (
        check_in_time,
        boarding_time,
        departure_time,
    ) = compute_trip_times_from_departure_and_offsets(
        trip_in.departure_time, boarding_min, checkin_min
    )
    payload = TripBase(
        mission_id=trip_in.mission_id,
        name=trip_in.name,
        type=trip_in.type,
        active=trip_in.active,
        unlisted=trip_in.unlisted,
        booking_mode=trip_in.booking_mode,
        sales_open_at=trip_in.sales_open_at,
        check_in_time=check_in_time,
        boarding_time=boarding_time,
        departure_time=departure_time,
    )
    temp_trip = Trip.model_validate(payload)
    is_valid, error_msg = validate_trip_time_ordering(temp_trip)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot create trip: {error_msg}",
        )
    is_valid, error_msg = validate_trip_dates(temp_trip, mission, launch)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot create trip: {error_msg}",
        )
    trip = crud.create_trip(session=session, trip_in=payload)
    return trip_to_public(session, trip)


@router.post(
    "/create-full",
    response_model=TripPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_trip_full(
    *,
    session: Session = Depends(deps.get_db),
    trip_in: TripCreateFull,
) -> Any:
    """
    Create trip with boats, pricing, and merchandise in a single transaction.
    """
    mission = crud.get_mission(session=session, mission_id=trip_in.mission_id)
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission with ID {trip_in.mission_id} not found",
        )
    launch = crud.get_launch(session=session, launch_id=mission.launch_id)
    if not launch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Launch for mission {trip_in.mission_id} not found",
        )

    boarding_min = trip_in.boarding_minutes_before_departure
    checkin_min = trip_in.checkin_minutes_before_boarding
    if boarding_min is None or checkin_min is None:
        default_boarding, default_checkin = get_default_offsets_for_type(trip_in.type)
        if boarding_min is None:
            boarding_min = default_boarding
        if checkin_min is None:
            checkin_min = default_checkin

    (
        check_in_time,
        boarding_time,
        departure_time,
    ) = compute_trip_times_from_departure_and_offsets(
        trip_in.departure_time, boarding_min, checkin_min
    )
    payload = TripBase(
        mission_id=trip_in.mission_id,
        name=trip_in.name,
        type=trip_in.type,
        active=trip_in.active,
        unlisted=trip_in.unlisted,
        booking_mode=trip_in.booking_mode,
        sales_open_at=trip_in.sales_open_at,
        check_in_time=check_in_time,
        boarding_time=boarding_time,
        departure_time=departure_time,
    )
    temp_trip = Trip.model_validate(payload)
    is_valid, error_msg = validate_trip_time_ordering(temp_trip)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot create trip: {error_msg}",
        )
    is_valid, error_msg = validate_trip_dates(temp_trip, mission, launch)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot create trip: {error_msg}",
        )

    new_trip = crud.create_trip(session=session, trip_in=payload)

    for boat_item in trip_in.boats:
        new_tb = crud.create_trip_boat(
            session=session,
            trip_boat_in=TripBoatCreate(
                trip_id=new_trip.id,
                boat_id=boat_item.boat_id,
                max_capacity=boat_item.max_capacity,
                use_only_trip_pricing=boat_item.use_only_trip_pricing,
                sales_enabled=boat_item.sales_enabled,
            ),
        )
        if boat_item.max_capacity is not None:
            capacities = crud.get_effective_capacity_per_ticket_type(
                session=session,
                trip_id=new_trip.id,
                boat_id=boat_item.boat_id,
            )
            constrained_sum = sum(v for v in capacities.values() if v is not None)
            if constrained_sum > boat_item.max_capacity:
                crud.delete_trip_boat(session=session, trip_boat_id=new_tb.id)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Custom capacity ({boat_item.max_capacity}) cannot be less than "
                        f"the sum of ticket-type capacities ({constrained_sum}). "
                        "Reduce per-type capacities or increase max capacity."
                    ),
                )
        boat = session.get(Boat, boat_item.boat_id)
        effective_max = (
            boat_item.max_capacity
            if boat_item.max_capacity is not None
            else (boat.capacity if boat else 0)
        )
        for p in boat_item.pricing:
            capacities = crud.get_effective_capacity_per_ticket_type(
                session=session,
                trip_id=new_trip.id,
                boat_id=boat_item.boat_id,
            )
            capacities = dict(capacities)
            capacities[p.ticket_type] = p.capacity
            constrained_sum = sum(v for v in capacities.values() if v is not None)
            if constrained_sum > effective_max:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Sum of constrained ticket-type capacities ({constrained_sum}) "
                        f"would exceed trip/boat max capacity ({effective_max})"
                    ),
                )
            crud.create_trip_boat_pricing(
                session=session,
                trip_boat_pricing_in=TripBoatPricingCreate(
                    trip_boat_id=new_tb.id,
                    ticket_type=p.ticket_type,
                    price=p.price,
                    capacity=p.capacity,
                ),
            )

    for merch_item in trip_in.merchandise:
        crud.create_trip_merchandise(
            session=session,
            trip_merchandise_in=TripMerchandiseCreate(
                trip_id=new_trip.id,
                merchandise_id=merch_item.merchandise_id,
                quantity_available_override=merch_item.quantity_available_override,
                price_override=merch_item.price_override,
            ),
        )

    session.refresh(new_trip)
    trip_with_boats = (
        session.exec(
            select(Trip)
            .where(Trip.id == new_trip.id)
            .options(
                selectinload(Trip.trip_boats).selectinload(TripBoat.boat),
            )
        )
        .unique()
        .one()
    )
    return trip_to_public(session, trip_with_boats)


@router.get(
    "/{trip_id}",
    response_model=TripPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_trip(
    *,
    session: Session = Depends(deps.get_db),
    trip_id: uuid.UUID,
) -> Any:
    """
    Get trip by ID.
    """
    trip = crud.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} not found",
        )
    return trip_to_public(session, trip)


@router.post(
    "/{trip_id}/duplicate",
    response_model=TripPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def duplicate_trip(
    *,
    session: Session = Depends(deps.get_db),
    trip_id: uuid.UUID,
) -> Any:
    """
    Duplicate a trip: create a new trip with the same mission, times, boats,
    ticket pricing, and merchandise. The new trip name is "{original name} (copy)".
    """
    trip = crud.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} not found",
        )
    copy_name = (trip.name or "Trip").strip()
    if copy_name:
        copy_name = f"{copy_name} (copy)"
    else:
        copy_name = "Trip (copy)"
    payload = TripBase(
        mission_id=trip.mission_id,
        name=copy_name,
        type=trip.type,
        active=trip.active,
        unlisted=trip.unlisted,
        booking_mode=trip.booking_mode,
        sales_open_at=trip.sales_open_at,
        check_in_time=trip.check_in_time,
        boarding_time=trip.boarding_time,
        departure_time=trip.departure_time,
    )
    new_trip = crud.create_trip(session=session, trip_in=payload)
    trip_boats = crud.get_trip_boats_by_trip(session=session, trip_id=trip_id)
    old_to_new_tb: dict[uuid.UUID, Any] = {}
    for tb in trip_boats:
        new_tb = crud.create_trip_boat(
            session=session,
            trip_boat_in=TripBoatCreate(
                trip_id=new_trip.id,
                boat_id=tb.boat_id,
                max_capacity=tb.max_capacity,
                use_only_trip_pricing=tb.use_only_trip_pricing,
                sales_enabled=tb.sales_enabled,
            ),
        )
        old_to_new_tb[tb.id] = new_tb
    for tb in trip_boats:
        new_tb = old_to_new_tb.get(tb.id)
        if not new_tb:
            continue
        for pricing in crud.get_trip_boat_pricing_by_trip_boat(
            session=session, trip_boat_id=tb.id
        ):
            crud.create_trip_boat_pricing(
                session=session,
                trip_boat_pricing_in=TripBoatPricingCreate(
                    trip_boat_id=new_tb.id,
                    ticket_type=pricing.ticket_type,
                    price=pricing.price,
                    capacity=pricing.capacity,
                ),
            )
    for tm in crud.get_trip_merchandise_by_trip(session=session, trip_id=trip_id):
        crud.create_trip_merchandise(
            session=session,
            trip_merchandise_in=TripMerchandiseCreate(
                trip_id=new_trip.id,
                merchandise_id=tm.merchandise_id,
                quantity_available_override=tm.quantity_available_override,
                price_override=tm.price_override,
            ),
        )
    session.refresh(new_trip)
    trip_with_boats = (
        session.exec(
            select(Trip)
            .where(Trip.id == new_trip.id)
            .options(
                selectinload(Trip.trip_boats).selectinload(TripBoat.boat),
            )
        )
        .unique()
        .one()
    )
    return trip_to_public(session, trip_with_boats)


class ReassignBoatBody(BaseModel):
    from_boat_id: uuid.UUID
    to_boat_id: uuid.UUID
    type_mapping: dict[str, str] = Field(
        default_factory=dict,
        description="Map source boat ticket type to target boat ticket type for each type being moved.",
    )


class ReassignBoatResponse(BaseModel):
    moved: int


@router.post(
    "/{trip_id}/reassign-boat",
    response_model=ReassignBoatResponse,
    dependencies=[Depends(get_current_active_superuser)],
)
def reassign_trip_boat(
    *,
    session: Session = Depends(deps.get_db),
    trip_id: uuid.UUID,
    body: ReassignBoatBody,
) -> Any:
    """
    Move all passengers from one boat to another on this trip.
    Both boats must be on the trip. Per-type capacity on the target boat is enforced;
    type_mapping must map each source ticket type to a target boat ticket type.
    """
    trip = crud.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} not found",
        )
    from_boat_id = body.from_boat_id
    to_boat_id = body.to_boat_id
    type_mapping = body.type_mapping or {}
    if from_boat_id == to_boat_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and target boat must be different",
        )
    trip_boats = crud.get_trip_boats_by_trip(session=session, trip_id=trip_id)
    boat_ids_on_trip = [tb.boat_id for tb in trip_boats]
    if from_boat_id not in boat_ids_on_trip or to_boat_id not in boat_ids_on_trip:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both boats must be assigned to this trip",
        )
    source_counts = crud.get_ticket_item_count_per_type_for_trip_boat(
        session=session, trip_id=trip_id, boat_id=from_boat_id
    )
    if not source_counts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No passengers to move from the source boat",
        )
    source_types_with_passengers = [t for t, qty in source_counts.items() if qty > 0]
    missing = [t for t in source_types_with_passengers if t not in type_mapping]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Type mapping required for source ticket type(s): {', '.join(sorted(missing))}. "
                "Map each source type to a target boat ticket type."
            ),
        )
    target_capacity = crud.get_effective_capacity_per_ticket_type(
        session=session, trip_id=trip_id, boat_id=to_boat_id
    )
    target_current = crud.get_ticket_item_count_per_type_for_trip_boat(
        session=session, trip_id=trip_id, boat_id=to_boat_id
    )
    invalid_target = [
        type_mapping[t]
        for t in source_types_with_passengers
        if type_mapping[t] not in target_capacity
    ]
    if invalid_target:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Target boat has no capacity for ticket type(s): "
                f"{', '.join(sorted(set(invalid_target)))}. "
                "Map source types only to ticket types defined on the target boat."
            ),
        )
    moved_by_target: dict[str, int] = {}
    for src_type, qty in source_counts.items():
        if qty <= 0:
            continue
        tgt_type = type_mapping.get(src_type)
        if tgt_type:
            moved_by_target[tgt_type] = moved_by_target.get(tgt_type, 0) + qty
    for tgt_type, moved_qty in moved_by_target.items():
        cap = target_capacity.get(tgt_type)
        if cap is not None:
            current = target_current.get(tgt_type, 0)
            if current + moved_qty > cap:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Target boat has capacity for {tgt_type} of {cap} "
                        f"(currently {current}). Mapping would add {moved_qty}. "
                        "Adjust type mapping or choose another boat."
                    ),
                )
    try:
        moved = crud.reassign_trip_boat_passengers(
            session=session,
            trip_id=trip_id,
            from_boat_id=from_boat_id,
            to_boat_id=to_boat_id,
            type_mapping=type_mapping,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    return ReassignBoatResponse(moved=moved)


class TripCapacityResponse(BaseModel):
    total_capacity: int
    used_capacity: int


@router.get(
    "/{trip_id}/capacity",
    response_model=TripCapacityResponse,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_trip_capacity(
    *,
    session: Session = Depends(deps.get_db),
    trip_id: uuid.UUID,
) -> Any:
    """
    Get total and used passenger capacity for a trip (across all boats).
    """
    trip = crud.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} not found",
        )
    trip_boats = crud.get_trip_boats_by_trip(session=session, trip_id=trip_id)
    total_capacity = 0
    for tb in trip_boats:
        effective = tb.max_capacity if tb.max_capacity is not None else tb.boat.capacity
        total_capacity += effective
    paid_counts = crud.get_paid_ticket_count_per_boat_for_trip(
        session=session, trip_id=trip_id
    )
    used_capacity = sum(paid_counts.values())
    return TripCapacityResponse(
        total_capacity=total_capacity,
        used_capacity=used_capacity,
    )


@router.put(
    "/{trip_id}",
    response_model=TripPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_trip(
    *,
    session: Session = Depends(deps.get_db),
    trip_id: uuid.UUID,
    trip_in: TripUpdate,
) -> Any:
    """
    Update a trip.
    """
    trip = crud.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} not found",
        )

    # Get mission (either existing or new if being updated)
    mission_id = (
        trip_in.mission_id if trip_in.mission_id is not None else trip.mission_id
    )
    mission = crud.get_mission(session=session, mission_id=mission_id)
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission with ID {mission_id} not found",
        )

    # Get launch for date validation
    launch = crud.get_launch(session=session, launch_id=mission.launch_id)
    if not launch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Launch for mission {mission_id} not found",
        )

    if trip_in.archived is False and mission.archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot unarchive trip: its mission is archived. Unarchive the mission first.",
        )

    update_data = trip_in.model_dump(exclude_unset=True)
    time_fields = {
        "departure_time",
        "boarding_minutes_before_departure",
        "checkin_minutes_before_boarding",
    }
    if any(f in update_data for f in time_fields):
        effective_departure = update_data.get("departure_time") or trip.departure_time
        effective_departure = ensure_aware(effective_departure)
        boarding_min = update_data.get("boarding_minutes_before_departure")
        checkin_min = update_data.get("checkin_minutes_before_boarding")
        if boarding_min is None or checkin_min is None:
            dep = ensure_aware(trip.departure_time)
            board = ensure_aware(trip.boarding_time)
            check_in = ensure_aware(trip.check_in_time)
            if boarding_min is None:
                boarding_min = int((dep - board).total_seconds() // 60)
            if checkin_min is None:
                checkin_min = int((board - check_in).total_seconds() // 60)
        (
            check_in_time,
            boarding_time,
            departure_time,
        ) = compute_trip_times_from_departure_and_offsets(
            effective_departure, boarding_min, checkin_min
        )
        for k in time_fields:
            update_data.pop(k, None)
        update_data["check_in_time"] = check_in_time
        update_data["boarding_time"] = boarding_time
        update_data["departure_time"] = departure_time

    temp_trip_data = {**trip.model_dump(), **update_data}
    temp_trip = Trip.model_validate(temp_trip_data)
    if any(
        f in update_data for f in ["check_in_time", "boarding_time", "departure_time"]
    ):
        is_valid, error_msg = validate_trip_time_ordering(temp_trip)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot update trip: {error_msg}",
            )
        is_valid, error_msg = validate_trip_dates(temp_trip, mission, launch)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot update trip: {error_msg}",
            )

    trip = crud.update_trip(session=session, db_obj=trip, obj_in=update_data)
    return trip_to_public(session, trip)


@router.delete(
    "/{trip_id}",
    response_model=TripPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_trip(
    *,
    session: Session = Depends(deps.get_db),
    trip_id: uuid.UUID,
) -> Any:
    """
    Delete a trip.
    """
    trip = crud.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} not found",
        )
    booking_count, booking_codes = crud.get_trip_booking_count_and_codes(
        session=session, trip_id=trip_id
    )
    if booking_count > 0:
        max_codes = 10
        codes_preview = ", ".join(booking_codes[:max_codes])
        if booking_count > max_codes:
            codes_preview += f" (and {booking_count - max_codes} more)"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": f"Cannot delete trip: {booking_count} booking(s) are associated.",
                "booking_count": booking_count,
                "booking_codes": booking_codes,
                "codes_preview": codes_preview,
            },
        )
    # Build response before delete; after delete the trip is detached
    effective = crud.apply_sales_open_bump_if_needed(
        session=session,
        trip_id=trip.id,
        booking_mode=trip.booking_mode,
        sales_open_at=trip.sales_open_at,
    )
    tz = "UTC"
    mission = crud.get_mission(session=session, mission_id=trip.mission_id)
    if mission:
        launch = crud.get_launch(session=session, launch_id=mission.launch_id)
        if launch:
            location = crud.get_location(
                session=session, location_id=launch.location_id
            )
            if location:
                tz = location.timezone
    response_data = TripPublic(
        id=trip.id,
        mission_id=trip.mission_id,
        name=trip.name,
        type=trip.type,
        active=trip.active,
        unlisted=trip.unlisted,
        booking_mode=trip.booking_mode,
        sales_open_at=trip.sales_open_at,
        check_in_time=trip.check_in_time,
        boarding_time=trip.boarding_time,
        departure_time=trip.departure_time,
        created_at=trip.created_at,
        updated_at=trip.updated_at,
        trip_boats=[],
        timezone=tz,
        effective_booking_mode=effective,
    )
    crud.delete_trip(session=session, trip_id=trip_id)
    return response_data


@router.get(
    "/mission/{mission_id}",
    response_model=TripsPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_trips_by_mission(
    *,
    session: Session = Depends(deps.get_db),
    mission_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve trips for a specific mission.
    """
    # Verify that the mission exists
    mission = crud.get_mission(session=session, mission_id=mission_id)
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission with ID {mission_id} not found",
        )

    launch = crud.get_launch(session=session, launch_id=mission.launch_id)
    location = (
        crud.get_location(session=session, location_id=launch.location_id)
        if launch
        else None
    )
    tz = location.timezone if location else "UTC"

    statement = (
        select(Trip)
        .where(Trip.mission_id == mission_id)
        .order_by(Trip.check_in_time.desc())
        .offset(skip)
        .limit(limit)
    )
    trips = session.exec(statement).unique().all()
    count = len(trips)

    trip_dicts = []
    for trip in trips:
        effective = crud.apply_sales_open_bump_if_needed(
            session=session,
            trip_id=trip.id,
            booking_mode=trip.booking_mode,
            sales_open_at=trip.sales_open_at,
        )
        d = {
            "id": trip.id,
            "mission_id": trip.mission_id,
            "name": trip.name,
            "type": trip.type,
            "active": trip.active,
            "unlisted": trip.unlisted,
            "booking_mode": trip.booking_mode,
            "sales_open_at": trip.sales_open_at,
            "check_in_time": trip.check_in_time,
            "boarding_time": trip.boarding_time,
            "departure_time": trip.departure_time,
            "created_at": trip.created_at,
            "updated_at": trip.updated_at,
            "timezone": tz,
            "trip_boats": [],
            "effective_booking_mode": effective,
        }
        trip_dicts.append(d)

    return TripsPublic(data=trip_dicts, count=count)
