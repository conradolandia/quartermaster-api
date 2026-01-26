import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlmodel import Session

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    Trip,
    TripCreate,
    TripPublic,
    TripsPublic,
    TripUpdate,
)
from app.services.yaml_importer import YamlImporter
from app.services.yaml_validator import YamlValidationError

router = APIRouter(prefix="/trips", tags=["trips"])


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
    trips = crud.get_trips(session=session, skip=skip, limit=limit)
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

    trip = crud.create_trip(session=session, trip_in=trip_in)
    return trip


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
    return trip


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

    # If mission_id is being updated, verify that the new mission exists
    if trip_in.mission_id is not None:
        mission = crud.get_mission(session=session, mission_id=trip_in.mission_id)
        if not mission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Mission with ID {trip_in.mission_id} not found",
            )

    trip = crud.update_trip(session=session, db_obj=trip, obj_in=trip_in)
    return trip


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
    trip = crud.delete_trip(session=session, trip_id=trip_id)
    return trip


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

    # Get trips by mission and add unique() to handle eagerly loaded collections
    statement = (
        select(Trip).where(Trip.mission_id == mission_id).offset(skip).limit(limit)
    )
    trips = session.exec(statement).unique().all()
    count = len(trips)

    # Convert to dictionaries to break the ORM relationship chain
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

    # Filter trips by active status and mission booking_mode
    public_trips = []
    for trip in trips:
        # trips from get_trips_no_relationships are dicts
        if not trip["active"]:
            continue

        # Get the mission to check booking_mode
        mission = crud.get_mission(session=session, mission_id=trip["mission_id"])
        if not mission:
            continue

        # Filter based on booking_mode (default to "private" if not set)
        booking_mode = getattr(mission, "booking_mode", "private")
        if booking_mode == "private":
            continue  # Never show private trips in public endpoint
        elif booking_mode == "early_bird":
            # Only show if access_code is provided (validation happens elsewhere)
            if access_code:
                public_trips.append(trip)
        else:  # public
            public_trips.append(trip)

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

    # Check mission booking_mode
    mission = crud.get_mission(session=session, mission_id=trip.mission_id)
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission not found",
        )

    if mission.booking_mode == "private":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tickets are not yet available for this trip",
        )
    elif mission.booking_mode == "early_bird" and not access_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This trip requires an access code",
        )

    return trip


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

        return trip

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
