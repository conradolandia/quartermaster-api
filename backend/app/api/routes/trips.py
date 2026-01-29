import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlmodel import Session, select

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    DiscountCode,
    Trip,
    TripCreate,
    TripPublic,
    TripsPublic,
    TripUpdate,
)
from app.services.date_validator import (
    ensure_aware,
    is_trip_past,
    validate_trip_dates,
    validate_trip_time_ordering,
)
from app.services.yaml_importer import YamlImporter
from app.services.yaml_validator import YamlValidationError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trips", tags=["trips"])


def _trip_to_public(session: Session, trip: Trip) -> TripPublic:
    """Build TripPublic with timezone from trip's mission->launch->location."""
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
    return TripPublic(**data, timezone=tz)


@router.get(
    "/",
    response_model=TripsPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_trips(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve trips.
    """
    trips = crud.get_trips_no_relationships(session=session, skip=skip, limit=limit)
    count = crud.get_trips_count(session=session)
    return TripsPublic(data=trips, count=count)


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
    Create new trip.
    """
    # Verify that the mission exists
    mission = crud.get_mission(session=session, mission_id=trip_in.mission_id)
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission with ID {trip_in.mission_id} not found",
        )

    # Get the launch for date validation
    launch = crud.get_launch(session=session, launch_id=mission.launch_id)
    if not launch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Launch for mission {trip_in.mission_id} not found",
        )

    # Create temporary trip object for validation
    temp_trip = Trip.model_validate(trip_in)

    # Validate time ordering
    is_valid, error_msg = validate_trip_time_ordering(temp_trip)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot create trip: {error_msg}",
        )

    # Validate trip dates are coherent with mission/launch
    is_valid, error_msg = validate_trip_dates(temp_trip, mission, launch)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot create trip: {error_msg}",
        )

    trip = crud.create_trip(session=session, trip_in=trip_in)
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
    allow_past_edit: bool = False,
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

    # Check if trip is in the past and prevent editing unless override is allowed
    if is_trip_past(trip) and not allow_past_edit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update trip: This trip has already departed. Use allow_past_edit=true to override",
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

    # Merge update data with existing trip data for validation
    update_data = trip_in.model_dump(exclude_unset=True)
    temp_trip_data = {**trip.model_dump(), **update_data}
    temp_trip = Trip.model_validate(temp_trip_data)

    # Validate time ordering if any time fields are being updated
    if any(
        field in update_data
        for field in ["check_in_time", "boarding_time", "departure_time"]
    ):
        is_valid, error_msg = validate_trip_time_ordering(temp_trip)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot update trip: {error_msg}",
            )

    # Validate trip dates are coherent with mission/launch if dates or mission are being updated
    if any(
        field in update_data
        for field in ["mission_id", "check_in_time", "boarding_time", "departure_time"]
    ):
        is_valid, error_msg = validate_trip_dates(temp_trip, mission, launch)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot update trip: {error_msg}",
            )

    trip = crud.update_trip(session=session, db_obj=trip, obj_in=trip_in)

    # Log override action if past edit was allowed
    if allow_past_edit and is_trip_past(trip):
        logger.warning(
            f"Superuser override: Trip {trip_id} was edited despite being in the past"
        )

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
        check_in_time=trip.check_in_time,
        boarding_time=trip.boarding_time,
        departure_time=trip.departure_time,
        created_at=trip.created_at,
        updated_at=trip.updated_at,
        trip_boats=[],
        timezone=tz,
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

    trip_dicts = [
        {
            "id": trip.id,
            "mission_id": trip.mission_id,
            "type": trip.type,
            "active": trip.active,
            "check_in_time": trip.check_in_time,
            "boarding_time": trip.boarding_time,
            "departure_time": trip.departure_time,
            "created_at": trip.created_at,
            "updated_at": trip.updated_at,
            "timezone": tz,
        }
        for trip in trips
    ]

    return TripsPublic(data=trip_dicts, count=count)


@router.get("/public/", response_model=TripsPublic)
def read_public_trips(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    access_code: str | None = None,
) -> Any:
    """
    Retrieve public trips for booking form.
    Filters by booking_mode:
    - private: Not shown unless admin
    - early_bird: Shown if valid access_code provided
    - public: Always shown
    """
    trips = crud.get_trips_no_relationships(session=session, skip=skip, limit=limit)
    logger.info(f"Found {len(trips)} total trips in database")

    # Validate access code if provided - reuse the validation logic from validate-access endpoint
    discount_code = None
    if access_code:
        logger.info(f"Validating access code: {access_code}")
        try:
            # Query the discount code - use the same pattern as validate-access endpoint
            discount_code_obj = session.exec(
                select(DiscountCode).where(DiscountCode.code == access_code)
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

    # Filter trips by active status, mission booking_mode, and future dates
    now = datetime.now(timezone.utc)
    public_trips = []
    logger.info(
        f"Filtering {len(trips)} trips with access_code={access_code}, discount_code={'present' if discount_code else 'None'}"
    )
    for trip in trips:
        trip_id = trip.get("id", "unknown")
        trip_name = trip.get("type", "unknown")
        trip_active = trip.get("active", False)
        departure_time = trip.get("departure_time")

        logger.info(f"Processing trip {trip_id} ({trip_name}) - active: {trip_active}")

        # trips from get_trips_no_relationships are dicts
        if not trip_active:
            logger.info(f"Trip {trip_id} ({trip_name}) filtered out: not active")
            continue

        # Filter out past trips (ensure timezone-aware for comparison)
        if departure_time:
            departure_time = ensure_aware(departure_time)
            if departure_time < now:
                logger.info(
                    f"Trip {trip_id} ({trip_name}) filtered out: departure_time {departure_time} is in the past"
                )
                continue

        # Get the mission to check booking_mode and launch
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

        # Get launch to check if launch is in the past
        launch = crud.get_launch(session=session, launch_id=mission.launch_id)
        if not launch:
            logger.info(
                f"Trip {trip_id} ({trip_name}) filtered out: launch for mission {mission_id} not found"
            )
            continue

        # Filter out trips for past launches (ensure timezone-aware for comparison)
        launch_time = ensure_aware(launch.launch_timestamp)
        if launch_time < now:
            logger.info(
                f"Trip {trip_id} ({trip_name}) filtered out: launch {launch.launch_timestamp} is in the past"
            )
            continue

        # Filter based on booking_mode (default to "private" if not set)
        booking_mode = getattr(mission, "booking_mode", "private")
        logger.info(
            f"Trip {trip_id} ({trip_name}) - Mission: {mission.name} (ID: {mission.id}), booking_mode: {booking_mode}"
        )

        if booking_mode == "private":
            logger.info(
                f"Trip {trip_id} ({trip_name}) filtered out: booking_mode is private"
            )
            continue  # Never show private trips in public endpoint
        elif booking_mode == "early_bird":
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
                    f"Trip {trip_id} ({trip_name}) filtered out: access code restricted to mission {access_code_mission_id}, but trip is for mission {mission.id}"
                )
                continue
            logger.info(
                f"Trip {trip_id} ({trip_name}) included: early_bird with valid access code"
            )
            public_trips.append(trip)
        else:  # public
            logger.info(
                f"Trip {trip_id} ({trip_name}) included: booking_mode is public"
            )
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

    logger.info(
        f"Returning {len(public_trips)} public trips (access_code: {access_code})"
    )
    count = len(public_trips)
    return TripsPublic(data=public_trips, count=count)


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

    # Check mission booking_mode
    mission = crud.get_mission(session=session, mission_id=trip.mission_id)
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )

    # Get launch to check if launch is in the past
    launch = crud.get_launch(session=session, launch_id=mission.launch_id)
    if not launch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Launch not found",
        )

    # Filter out trips for past launches (ensure timezone-aware for comparison)
    launch_time = ensure_aware(launch.launch_timestamp)
    if launch_time < now:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} is for a launch that has already occurred",
        )

    if mission.booking_mode == "private":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tickets are not yet available for this trip",
        )
    elif mission.booking_mode == "early_bird":
        if not access_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This trip requires an access code",
            )

        # Validate the access code (same logic as read_public_trips)
        logger.info(f"Validating access code for trip {trip_id}: {access_code}")
        try:
            discount_code_obj = session.exec(
                select(DiscountCode).where(DiscountCode.code == access_code)
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
