import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    BoatPublic,
    DiscountCode,
    PublicTripsResponse,
    Trip,
    TripBase,
    TripBoat,
    TripBoatCreate,
    TripBoatPricingCreate,
    TripBoatPublic,
    TripCreate,
    TripMerchandiseCreate,
    TripPublic,
    TripsPublic,
    TripsWithStatsPublic,
    TripUpdate,
    TripWithStats,
)
from app.services.date_validator import (
    effective_booking_mode,
    ensure_aware,
    validate_trip_dates,
    validate_trip_time_ordering,
)
from app.services.trip_times import (
    compute_trip_times_from_departure_and_offsets,
    get_default_offsets_for_type,
)
from app.services.yaml_importer import YamlImporter
from app.services.yaml_validator import YamlValidationError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trips", tags=["trips"])


def _trip_to_public(session: Session, trip: Trip) -> TripPublic:
    """Build TripPublic with timezone and effective_booking_mode."""
    mission = crud.get_mission(session=session, mission_id=trip.mission_id)
    tz = "UTC"
    if mission:
        launch = crud.get_launch(session=session, launch_id=mission.launch_id)
        if launch:
            location = crud.get_location(
                session=session, location_id=launch.location_id
            )
            if location:
                tz = location.timezone
    data = trip.model_dump(mode="json", exclude={"mission"})
    data.setdefault("trip_boats", [])
    data["effective_booking_mode"] = effective_booking_mode(
        trip.booking_mode, trip.sales_open_at
    )
    return TripPublic(**data, timezone=tz)


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
) -> Any:
    """
    Retrieve trips with booking statistics.
    Optionally filter by mission_id and trip_type (launch_viewing, pre_launch).
    """
    trips = crud.get_trips_with_stats(
        session=session,
        skip=skip,
        limit=limit,
        mission_id=mission_id,
        type_=trip_type,
    )
    count = crud.get_trips_count(
        session=session,
        mission_id=mission_id,
        type_=trip_type,
    )
    if trips:
        trip_ids = [t["id"] for t in trips]
        trip_boats_by_trip = crud.get_trip_boats_for_trip_ids(
            session=session, trip_ids=trip_ids
        )
        for t in trips:
            t["effective_booking_mode"] = effective_booking_mode(
                t.get("booking_mode", "private"), t.get("sales_open_at")
            )
            t["trip_boats"] = [
                TripBoatPublic(
                    id=tb.id,
                    trip_id=tb.trip_id,
                    boat_id=tb.boat_id,
                    created_at=tb.created_at,
                    updated_at=tb.updated_at,
                    max_capacity=tb.max_capacity,
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
    return _trip_to_public(session, trip)


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
    return _trip_to_public(session, trip)


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
    return _trip_to_public(session, trip_with_boats)


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
        cap = target_capacity.get(tgt_type, 0)
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
    return _trip_to_public(session, trip)


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
    # Build response before delete; after delete the trip is detached
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
        effective_booking_mode=effective_booking_mode(
            trip.booking_mode, trip.sales_open_at
        ),
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
            "effective_booking_mode": effective_booking_mode(
                trip.booking_mode, trip.sales_open_at
            ),
        }
        trip_dicts.append(d)

    return TripsPublic(data=trip_dicts, count=count)


@router.get("/public/", response_model=PublicTripsResponse)
def read_public_trips(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    access_code: str | None = None,
) -> Any:
    """
    Retrieve public trips for booking form.
    Filters by trip booking_mode:
    - private: Not shown unless admin
    - early_bird: Shown if valid access_code provided
    - public: Always shown
    all_trips_require_access_code: True when every bookable trip is early_bird (show code prompt).
    """
    trips = crud.get_trips_no_relationships(session=session, skip=skip, limit=limit)
    logger.info(f"Found {len(trips)} total trips in database")

    # Validate access code if provided - reuse the validation logic from validate-access endpoint
    discount_code = None
    if access_code:
        logger.info(f"Validating access code: {access_code}")
        try:
            # Query the discount code (case-insensitive)
            discount_code_obj = session.exec(
                select(DiscountCode).where(
                    func.lower(DiscountCode.code) == access_code.lower()
                )
            ).first()

            if discount_code_obj:
                logger.info(
                    f"Discount code found - ID: {discount_code_obj.id}, code: {discount_code_obj.code}"
                )
                logger.info(
                    f"is_access_code: {discount_code_obj.is_access_code}, is_active: {discount_code_obj.is_active}"
                )

                # Access attributes directly like validate-access endpoint does
                # Check if it's an access code
                if not discount_code_obj.is_access_code:
                    logger.info("Access code validation failed: not an access code")
                    discount_code = None
                # Check if code is active
                elif not discount_code_obj.is_active:
                    logger.info("Access code validation failed: not active")
                    discount_code = None
                else:
                    # Validate the access code (same logic as validate-access endpoint)
                    now = datetime.now(timezone.utc)
                    valid_from = discount_code_obj.valid_from
                    valid_until = discount_code_obj.valid_until
                    max_uses = discount_code_obj.max_uses
                    used_count = discount_code_obj.used_count

                    # Check validity dates
                    if valid_from and now < valid_from:
                        logger.info(
                            f"Access code not yet valid (valid_from: {valid_from})"
                        )
                        discount_code = None
                    elif valid_until and now > valid_until:
                        logger.info(f"Access code expired (valid_until: {valid_until})")
                        discount_code = None
                    # Check usage limits
                    elif max_uses and used_count >= max_uses:
                        logger.info(
                            f"Access code usage limit reached ({used_count}/{max_uses})"
                        )
                        discount_code = None
                    else:
                        discount_code = discount_code_obj
                        logger.info("Access code validated successfully")
            else:
                logger.info(f"Access code not found: {access_code}")
        except Exception as e:
            logger.exception(f"Error validating access code: {e}")
            discount_code = None
    else:
        logger.info("No access code provided")

    # Filter trips by active status, trip booking_mode, and future dates
    now = datetime.now(timezone.utc)
    public_trips = []
    bookable_trip_count = 0
    public_trip_count = 0
    logger.info(
        f"Filtering {len(trips)} trips with access_code={access_code}, discount_code={'present' if discount_code else 'None'}"
    )
    for trip in trips:
        trip_id = trip.get("id", "unknown")
        trip_name = trip.get("type", "unknown")
        trip_active = trip.get("active", False)
        trip_unlisted = trip.get("unlisted", False)
        departure_time = trip.get("departure_time")
        booking_mode = trip.get("booking_mode", "private")

        logger.info(
            f"Processing trip {trip_id} ({trip_name}) - active: {trip_active}, unlisted: {trip_unlisted}, booking_mode: {booking_mode}"
        )

        # trips from get_trips_no_relationships are dicts
        if not trip_active:
            logger.info(f"Trip {trip_id} ({trip_name}) filtered out: not active")
            continue
        if trip_unlisted:
            logger.info(
                f"Trip {trip_id} ({trip_name}) filtered out: unlisted (only visible via direct link)"
            )
            continue

        # Filter out past trips (ensure timezone-aware for comparison)
        if departure_time:
            departure_time = ensure_aware(departure_time)
            if departure_time < now:
                logger.info(
                    f"Trip {trip_id} ({trip_name}) filtered out: departure_time {departure_time} is in the past"
                )
                continue

        # Get the mission for launch check
        mission_id = trip.get("mission_id")
        if not mission_id:
            logger.info(f"Trip {trip_id} ({trip_name}) filtered out: no mission_id")
            continue

        mission = crud.get_mission(session=session, mission_id=mission_id)
        if not mission:
            logger.info(
                f"Trip {trip_id} ({trip_name}) filtered out: mission {mission_id} not found"
            )
            continue

        # Get launch (required for mission/boat context; bookability uses trip.departure_time)
        launch = crud.get_launch(session=session, launch_id=mission.launch_id)
        if not launch:
            logger.info(
                f"Trip {trip_id} ({trip_name}) filtered out: launch for mission {mission_id} not found"
            )
            continue

        # Bookability is determined by trip.departure_time (already filtered above).
        # Do not filter by launch_timestamp: a trip can have future departure even if
        # the launch was rescheduled and the stored launch_timestamp is outdated.

        # Effective mode: before sales_open_at, one level more restrictive
        # (so early bird codes work before general sale)
        sales_open_at = trip.get("sales_open_at")
        effective_mode = effective_booking_mode(booking_mode, sales_open_at, now)

        # Count bookable trips for all_trips_require_access_code
        if effective_mode in ("public", "early_bird"):
            bookable_trip_count += 1
            if effective_mode == "public":
                public_trip_count += 1

        if effective_mode == "private":
            logger.info(
                f"Trip {trip_id} ({trip_name}) filtered out: effective booking_mode is private"
            )
            continue
        elif effective_mode == "early_bird":
            # Only show if valid access_code is provided
            if not access_code or not discount_code:
                logger.info(
                    f"Trip {trip_id} ({trip_name}) filtered out: early_bird but access_code={access_code}, discount_code={'present' if discount_code else 'None'}"
                )
                continue
            # If access code is restricted to a specific mission, check it matches
            access_code_mission_id = discount_code.access_code_mission_id
            logger.info(
                f"Trip {trip_id} ({trip_name}) - access_code_mission_id: {access_code_mission_id}, mission.id: {mission.id}"
            )
            if access_code_mission_id and access_code_mission_id != mission.id:
                logger.info(
                    f"Trip {trip_id} ({trip_name}) filtered out: access code restricted to another mission"
                )
                continue
            logger.info(
                f"Trip {trip_id} ({trip_name}) included: effective early_bird with valid access code"
            )
            trip["effective_booking_mode"] = effective_mode
            public_trips.append(trip)
        else:  # effective_mode == "public"
            logger.info(
                f"Trip {trip_id} ({trip_name}) included: effective booking_mode is public"
            )
            trip["effective_booking_mode"] = effective_mode
            public_trips.append(trip)

    # Sort trips by check_in_time (future first)
    # Trips without check_in_time go to the end
    public_trips.sort(
        key=lambda t: (
            ensure_aware(t.get("check_in_time"))
            if t.get("check_in_time")
            else datetime.min.replace(tzinfo=timezone.utc)
        ),
        reverse=True,
    )

    all_trips_require_access_code = bookable_trip_count > 0 and public_trip_count == 0
    logger.info(
        f"Returning {len(public_trips)} public trips (access_code: {access_code}), "
        f"all_trips_require_access_code: {all_trips_require_access_code}"
    )
    count = len(public_trips)
    return PublicTripsResponse(
        data=public_trips,
        count=count,
        all_trips_require_access_code=all_trips_require_access_code,
    )


@router.get("/public/{trip_id}", response_model=TripPublic)
def read_public_trip(
    *,
    session: Session = Depends(deps.get_db),
    trip_id: uuid.UUID,
    access_code: str | None = None,
) -> Any:
    """
    Get public trip by ID for booking form.
    Checks booking_mode to determine access.
    """
    logger.info(
        f"read_public_trip called for trip_id={trip_id}, access_code={access_code}"
    )
    trip = crud.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} not found",
        )
    if not trip.active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} is not available",
        )

    # Filter out past trips (ensure timezone-aware for comparison)
    now = datetime.now(timezone.utc)
    trip_departure = ensure_aware(trip.departure_time)
    if trip_departure < now:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} has already departed",
        )

    mission = crud.get_mission(session=session, mission_id=trip.mission_id)
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )

    launch = crud.get_launch(session=session, launch_id=mission.launch_id)
    if not launch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Launch not found",
        )

    # Bookability is determined by trip.departure_time (already checked above).
    # Do not filter by launch_timestamp: a trip can have future departure even if
    # the launch was rescheduled and the stored launch_timestamp is outdated.

    # Effective mode: before sales_open_at, one level more restrictive
    booking_mode = effective_booking_mode(
        getattr(trip, "booking_mode", "private"),
        getattr(trip, "sales_open_at", None),
        now,
    )
    if booking_mode == "private":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tickets are not yet available for this trip",
        )
    elif booking_mode == "early_bird":
        if not access_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This trip requires an access code",
            )

        # Validate the access code (same logic as read_public_trips, case-insensitive)
        logger.info(f"Validating access code for trip {trip_id}: {access_code}")
        try:
            discount_code_obj = session.exec(
                select(DiscountCode).where(
                    func.lower(DiscountCode.code) == access_code.lower()
                )
            ).first()

            if not discount_code_obj:
                logger.info(f"Access code {access_code} not found")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid access code",
                )

            logger.info(
                f"Access code found - is_access_code: {discount_code_obj.is_access_code}, is_active: {discount_code_obj.is_active}"
            )

            # Check if it's an access code
            if not discount_code_obj.is_access_code:
                logger.info("Access code validation failed: not an access code")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid access code",
                )

            # Check if code is active
            if not discount_code_obj.is_active:
                logger.info("Access code validation failed: not active")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access code is not active",
                )

            # Validate the access code (same logic as validate-access endpoint)
            now = datetime.now(timezone.utc)
            valid_from = discount_code_obj.valid_from
            valid_until = discount_code_obj.valid_until
            max_uses = discount_code_obj.max_uses
            used_count = discount_code_obj.used_count

            # Check validity dates
            if valid_from and now < valid_from:
                logger.info(f"Access code not yet valid (valid_from: {valid_from})")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access code is not yet valid",
                )
            elif valid_until and now > valid_until:
                logger.info(f"Access code expired (valid_until: {valid_until})")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access code has expired",
                )

            # Check usage limits
            elif max_uses and used_count >= max_uses:
                logger.info(
                    f"Access code usage limit reached ({used_count}/{max_uses})"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access code usage limit reached",
                )

            # If access code is restricted to a specific mission, check it matches
            access_code_mission_id = discount_code_obj.access_code_mission_id
            if access_code_mission_id and access_code_mission_id != mission.id:
                logger.info(
                    f"Access code restricted to mission {access_code_mission_id}, but trip is for mission {mission.id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access code is not valid for this trip",
                )

            logger.info("Access code validated successfully")
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(f"Error validating access code: {e}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Error validating access code",
            )

    return _trip_to_public(session, trip)


@router.post(
    "/import-yaml",
    response_model=TripPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def import_trip_from_yaml(
    *,
    session: Session = Depends(deps.get_db),
    file: UploadFile = File(...),
) -> Any:
    """
    Import a trip from YAML file.

    Expected YAML format:
    ```yaml
    name: "Mars Sample Return Viewing Experience"
    mission_id: "mars-sample-return"
    type: "launch_viewing"
    base_price: 299.99
    departure_time: "2024-03-15T10:00:00Z"
    return_time: "2024-03-15T18:00:00Z"
    departure_location_id: "port-canaveral-marina"
    description: "Watch the historic Mars Sample Return launch"
    max_capacity: 50
    ```
    """
    try:
        # Validate file type
        if not file.filename.endswith((".yaml", ".yml")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be a YAML file (.yaml or .yml)",
            )

        # Read file content
        yaml_content = file.file.read().decode("utf-8")

        # Import using YamlImporter
        importer = YamlImporter(session)
        trip = importer.import_trip(yaml_content)

        return _trip_to_public(session, trip)

    except YamlValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"YAML validation error: {e.message}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import trip: {str(e)}",
        )
