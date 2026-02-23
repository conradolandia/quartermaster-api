"""
Discount code restriction validation.

Validates that a discount code can be used for the given trips based on
restricted_trip_type, restricted_launch_id, restricted_mission_id, restricted_trip_id.
"""

import uuid

from fastapi import HTTPException, status
from sqlmodel import Session

from app.models import DiscountCode, Mission, Trip


def check_discount_code_restrictions(
    *,
    session: Session,
    discount_code: DiscountCode,
    trip_ids: list[uuid.UUID],
) -> None:
    """
    Validate that discount code restrictions allow use for the given trips.
    Raises HTTPException if any restriction is violated.
    """
    if not trip_ids:
        return
    has_restriction = (
        discount_code.restricted_trip_type is not None
        or discount_code.restricted_launch_id is not None
        or discount_code.restricted_mission_id is not None
        or discount_code.restricted_trip_id is not None
    )
    if not has_restriction:
        return

    for trip_id in trip_ids:
        trip = session.get(Trip, trip_id)
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Trip {trip_id} not found",
            )
        mission = session.get(Mission, trip.mission_id)
        if not mission:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mission not found for trip",
            )

        if discount_code.restricted_trip_id is not None:
            if discount_code.restricted_trip_id != trip_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Discount code is not valid for this trip",
                )
        if discount_code.restricted_mission_id is not None:
            if discount_code.restricted_mission_id != trip.mission_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Discount code is not valid for this mission",
                )
        if discount_code.restricted_launch_id is not None:
            if discount_code.restricted_launch_id != mission.launch_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Discount code is not valid for this launch",
                )
        if discount_code.restricted_trip_type is not None:
            if discount_code.restricted_trip_type != trip.type:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Discount code is only valid for {discount_code.restricted_trip_type} trips",
                )
