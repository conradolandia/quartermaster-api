"""
Discount code restriction validation.

Validates that a discount code can be used for the given trips based on
restricted_trip_type, restricted_launch_id, restricted_mission_id, restricted_trip_id.
"""

import uuid

from fastapi import HTTPException, status
from sqlmodel import Session

from app.models import DiscountCode, Mission, Trip


def _has_discount_restrictions(discount_code: DiscountCode) -> bool:
    return (
        discount_code.restricted_trip_type is not None
        or discount_code.restricted_launch_id is not None
        or discount_code.restricted_mission_id is not None
        or discount_code.restricted_trip_id is not None
    )


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
    if not _has_discount_restrictions(discount_code):
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


def discount_code_restriction_violation_message(
    *,
    session: Session,
    discount_code: DiscountCode,
    trip_id: uuid.UUID | None = None,
    mission_id: uuid.UUID | None = None,
) -> str | None:
    """
    Return a user-facing message when discount/access code restrictions fail.
    None if restrictions pass or no applicable restrictions.
    """
    if not _has_discount_restrictions(discount_code):
        return None

    if trip_id is not None:
        try:
            check_discount_code_restrictions(
                session=session,
                discount_code=discount_code,
                trip_ids=[trip_id],
            )
        except HTTPException as exc:
            detail = exc.detail
            return detail if isinstance(detail, str) else str(detail)
        return None

    if (
        discount_code.restricted_trip_id is not None
        or discount_code.restricted_trip_type is not None
    ):
        return "Access code is not valid for this trip"

    if mission_id is not None:
        mission = session.get(Mission, mission_id)
        if not mission:
            return "Mission not found"
        if (
            discount_code.restricted_mission_id is not None
            and discount_code.restricted_mission_id != mission_id
        ):
            return "Access code is not valid for this mission"
        if (
            discount_code.restricted_launch_id is not None
            and discount_code.restricted_launch_id != mission.launch_id
        ):
            return "Access code is not valid for this launch"

    return None
