import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    TripBoatCreate,
    TripBoatUpdate,
)

router = APIRouter(prefix="/trip-boats", tags=["trip-boats"])


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_trip_boat(
    *,
    session: Session = Depends(deps.get_db),
    trip_boat_in: TripBoatCreate,
) -> Any:
    """
    Create new trip boat association.
    """
    # Verify that the trip exists
    trip = crud.get_trip(session=session, trip_id=trip_boat_in.trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_boat_in.trip_id} not found",
        )

    # Verify that the boat exists
    boat = crud.get_boat(session=session, boat_id=trip_boat_in.boat_id)
    if not boat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Boat with ID {trip_boat_in.boat_id} not found",
        )

    trip_boat = crud.create_trip_boat(session=session, trip_boat_in=trip_boat_in)
    return trip_boat


@router.get("/trip/{trip_id}", dependencies=[Depends(get_current_active_superuser)])
def read_trip_boats_by_trip(
    *,
    session: Session = Depends(deps.get_db),
    trip_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Get all boats for a specific trip.
    """
    # Verify that the trip exists
    trip = crud.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} not found",
        )

    trip_boats = crud.get_trip_boats_by_trip(
        session=session, trip_id=trip_id, skip=skip, limit=limit
    )
    return trip_boats


@router.get("/boat/{boat_id}", dependencies=[Depends(get_current_active_superuser)])
def read_trip_boats_by_boat(
    *,
    session: Session = Depends(deps.get_db),
    boat_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Get all trips for a specific boat.
    """
    # Verify that the boat exists
    boat = crud.get_boat(session=session, boat_id=boat_id)
    if not boat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Boat with ID {boat_id} not found",
        )

    trip_boats = crud.get_trip_boats_by_boat(
        session=session, boat_id=boat_id, skip=skip, limit=limit
    )
    return trip_boats


@router.put("/{trip_boat_id}", dependencies=[Depends(get_current_active_superuser)])
def update_trip_boat(
    *,
    session: Session = Depends(deps.get_db),
    trip_boat_id: uuid.UUID,
    trip_boat_in: TripBoatUpdate,
) -> Any:
    """
    Update a trip boat association.
    """
    trip_boat = crud.get_trip_boat(session=session, trip_boat_id=trip_boat_id)
    if not trip_boat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip Boat with ID {trip_boat_id} not found",
        )

    # If trip_id is being updated, verify that the new trip exists
    if trip_boat_in.trip_id is not None:
        trip = crud.get_trip(session=session, trip_id=trip_boat_in.trip_id)
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip with ID {trip_boat_in.trip_id} not found",
            )

    # If boat_id is being updated, verify that the new boat exists
    if trip_boat_in.boat_id is not None:
        boat = crud.get_boat(session=session, boat_id=trip_boat_in.boat_id)
        if not boat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Boat with ID {trip_boat_in.boat_id} not found",
            )

    trip_boat = crud.update_trip_boat(
        session=session, db_obj=trip_boat, obj_in=trip_boat_in
    )
    return trip_boat


@router.delete("/{trip_boat_id}", dependencies=[Depends(get_current_active_superuser)])
def delete_trip_boat(
    *,
    session: Session = Depends(deps.get_db),
    trip_boat_id: uuid.UUID,
) -> Any:
    """
    Delete a trip boat association.
    """
    trip_boat = crud.get_trip_boat(session=session, trip_boat_id=trip_boat_id)
    if not trip_boat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip Boat with ID {trip_boat_id} not found",
        )
    trip_boat = crud.delete_trip_boat(session=session, trip_boat_id=trip_boat_id)
    return trip_boat


# Public endpoint (no authentication required)
@router.get("/public/trip/{trip_id}")
def read_public_trip_boats_by_trip(
    *,
    session: Session = Depends(deps.get_db),
    trip_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Get all boats for a specific trip (public endpoint for booking form).
    Validates that the trip's mission has public or early_bird booking_mode.
    """
    # Verify that the trip exists
    trip = crud.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} not found",
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

    trip_boats = crud.get_trip_boats_by_trip(
        session=session, trip_id=trip_id, skip=skip, limit=limit
    )
    return trip_boats
