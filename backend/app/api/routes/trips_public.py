import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlmodel import Session, select

from app import crud
from app.api import deps
from app.models import DiscountCode, PublicTripsResponse, TripPublic
from app.services.date_validator import effective_booking_mode, ensure_aware

from .trip_utils import trip_to_public

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trips", tags=["trips"])


@router.get("/public/", response_model=PublicTripsResponse)
def read_public_trips(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    access_code: str | None = None,
    include_trip_id: uuid.UUID | None = None,
) -> Any:
    """
    Retrieve public trips for booking form.
    Filters by trip booking_mode:
    - private: Not shown unless admin
    - early_bird: Shown if valid access_code provided
    - public: Always shown
    When trip_id is provided (direct link), include that trip even if unlisted.
    all_trips_require_access_code: True when every bookable trip is early_bird (show code prompt).
    Archived trips are always excluded from public listing.
    """
    trips = crud.get_trips_no_relationships(
        session=session, skip=skip, limit=limit, include_archived=False
    )
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
        trip_archived = trip.get("archived", False)
        departure_time = trip.get("departure_time")
        booking_mode = trip.get("booking_mode", "private")

        logger.info(
            f"Processing trip {trip_id} ({trip_name}) - active: {trip_active}, unlisted: {trip_unlisted}, archived: {trip_archived}, booking_mode: {booking_mode}"
        )

        # trips from get_trips_no_relationships are dicts; we pass include_archived=False so archived are already excluded, skip if present anyway
        if trip_archived:
            logger.info(f"Trip {trip_id} ({trip_name}) filtered out: archived")
            continue
        if not trip_active:
            logger.info(f"Trip {trip_id} ({trip_name}) filtered out: not active")
            continue
        if trip_unlisted:
            if include_trip_id and str(trip.get("id")) == str(include_trip_id):
                logger.info(
                    f"Trip {trip_id} ({trip_name}) included: unlisted but requested via direct link (include_trip_id)"
                )
            else:
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

        # Use effective mode for filtering only (no persist here to avoid N commits and ~5s latency)
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
    if getattr(trip, "archived", False):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} is archived",
        )
    if not trip.active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} is not active",
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

    booking_mode = crud.apply_sales_open_bump_if_needed(
        session=session,
        trip_id=trip.id,
        booking_mode=getattr(trip, "booking_mode", "private"),
        sales_open_at=getattr(trip, "sales_open_at", None),
        now=now,
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

    return trip_to_public(session, trip)
