"""
Booking utilities and shared functions.

This module contains utility functions used across multiple booking endpoints
to avoid code duplication and improve maintainability.

Pricing formula for sales:
  (subtotal - discount_amount) * (1 + tax_rate) + tip_amount = total_amount
  Equivalently: after_discount = subtotal - discount_amount (or subtotal * (1 - discount_percent));
  tax_amount = after_discount * tax_rate;
  total_amount = after_discount * (1 + tax_rate) + tip_amount.
"""

import base64
import io
import logging
import secrets
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

import qrcode
from fastapi import HTTPException, status
from sqlalchemy import nulls_first
from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.models import Booking, BookingItem, Launch, Location, Mission, Trip

# Set up logging
logger = logging.getLogger(__name__)


def compute_booking_totals(
    subtotal_cents: int,
    discount_amount_cents: int,
    tax_rate: float,
    tip_amount_cents: int,
) -> tuple[int, int]:
    """
    Compute tax_amount and total_amount in cents from the standard pricing formula.

    Formula: (subtotal - discount) * (1 + tax_rate) + tip = total (all in cents).

    Args:
        subtotal_cents: Sum of item prices before discount (cents).
        discount_amount_cents: Discount amount (cents).
        tax_rate: Tax rate as decimal (e.g. 0.06 for 6%).
        tip_amount_cents: Tip amount (cents).

    Returns:
        (tax_amount_cents, total_amount_cents)
    """
    after_discount_cents = max(0, subtotal_cents - discount_amount_cents)
    tax_amount_cents = round(after_discount_cents * tax_rate)
    total_amount_cents = after_discount_cents + tax_amount_cents + tip_amount_cents
    return (tax_amount_cents, total_amount_cents)


def generate_qr_code(confirmation_code: str) -> str:
    """
    Generate a QR code for a booking confirmation code and return as base64 string.

    Args:
        confirmation_code: The booking confirmation code

    Returns:
        Base64 encoded PNG image string
    """
    # Build target URL (prefer explicit QR_CODE_BASE_URL if provided)
    # QR codes point to admin check-in so staff can scan and check in directly.
    base_url = settings.QR_CODE_BASE_URL or settings.FRONTEND_HOST
    qr_url = f"{base_url}/check-in?code={confirmation_code}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def generate_unique_confirmation_code(session: Session) -> str:
    """
    Generate a unique confirmation code for a new booking.

    Args:
        session: Database session to check uniqueness

    Returns:
        A unique 8-character uppercase alphanumeric code
    """
    for _ in range(20):
        code = secrets.token_hex(4).upper()
        existing = session.exec(
            select(Booking).where(Booking.confirmation_code == code)
        ).first()
        if not existing:
            return code
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate unique confirmation code",
    )


def validate_confirmation_code(confirmation_code: str) -> None:
    """
    Validate a confirmation code format.

    Args:
        confirmation_code: The confirmation code to validate

    Raises:
        HTTPException: If the confirmation code is invalid
    """
    if not confirmation_code or len(confirmation_code) < 3:
        logger.warning(f"Invalid booking confirmation code format: {confirmation_code}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid booking confirmation code format",
        )


def get_booking_items_in_display_order(
    session: Session, booking_id: uuid.UUID
) -> list[BookingItem]:
    """
    Return booking items in display order: tickets first (trip_merchandise_id null),
    then merchandise; within each group by item_type, then id.
    """
    return list(
        session.exec(
            select(BookingItem)
            .where(BookingItem.booking_id == booking_id)
            .order_by(
                nulls_first(BookingItem.trip_merchandise_id.asc()),
                BookingItem.item_type,
                BookingItem.id,
            )
        ).all()
    )


def get_booking_with_items(
    session: Session, confirmation_code: str, include_qr_generation: bool = True
) -> Booking | None:
    """
    Get a booking by confirmation code with its items.

    Args:
        session: Database session
        confirmation_code: The booking confirmation code
        include_qr_generation: Whether to generate QR code if missing

    Returns:
        Booking object with items loaded, or None if not found

    Raises:
        HTTPException: If confirmation code is invalid or booking not found
    """
    validate_confirmation_code(confirmation_code)

    # Fetch booking
    booking = session.exec(
        select(Booking).where(Booking.confirmation_code == confirmation_code)
    ).first()

    if not booking:
        logger.info(f"Booking not found for confirmation code: {confirmation_code}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found with the provided confirmation code",
        )

    # Fetch items in display order (tickets first, then merch)
    try:
        items = get_booking_items_in_display_order(session, booking.id)

        if not items:
            logger.warning(f"Booking found but has no items: {booking.id}")
    except Exception as e:
        logger.error(f"Error retrieving items for booking {booking.id}: {str(e)}")
        # Continue without items rather than failing completely

    # Handle QR code generation if requested
    if include_qr_generation and not booking.qr_code_base64:
        logger.info(f"Generating missing QR code for booking: {booking.id}")
        try:
            booking.qr_code_base64 = generate_qr_code(booking.confirmation_code)
            session.add(booking)
            session.commit()
        except Exception as e:
            logger.error(
                f"Failed to generate QR code for booking {booking.id}: {str(e)}"
            )
            # Continue even if QR code generation fails
            session.rollback()

    return booking


def get_mission_name_for_booking(session: Session, booking: Booking) -> str:
    """
    Get the mission name for a booking.

    Args:
        session: Database session
        booking: The booking object

    Returns:
        Mission name or default fallback
    """
    mission_name = "Space Mission"  # Default fallback

    if booking.items:
        first_trip = session.get(Trip, booking.items[0].trip_id)
        if first_trip:
            mission = session.get(Mission, first_trip.mission_id)
            if mission:
                mission_name = mission.name

    return mission_name


def prepare_booking_items_for_email(booking: Booking) -> list[dict]:
    """
    Prepare booking items for email templates.

    Args:
        booking: The booking object

    Returns:
        List of booking items formatted for email
    """
    booking_items = []
    for item in booking.items:
        booking_items.append(
            {
                "type": item.item_type.replace("_", " ").title(),
                "quantity": item.quantity,
                "price_per_unit": item.price_per_unit
                / 100.0,  # cents to dollars for email display
            }
        )
    return booking_items


def _format_dt_iso_for_email(iso: str | None, tz: str | None) -> str | None:
    """Format ISO datetime in timezone for email display."""
    if not iso or not tz:
        return None
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.astimezone(ZoneInfo(tz)).strftime("%b %d, %Y at %I:%M %p")
    except Exception:
        return iso


def build_experience_display_dict(session: Session, items: list) -> dict | None:
    """
    Build experience display dict from first booking item (trip/mission/launch/boat/provider).
    Used for public booking detail and confirmation email.

    Returns:
        Dict with BookingExperienceDisplay fields plus check_in_display, boarding_display,
        departure_display, launch_time_display for email. None if no items or trip.
    """
    if not items:
        return None
    first = items[0]
    trip = session.get(Trip, first.trip_id)
    if not trip:
        return None
    mission = session.get(Mission, trip.mission_id) if trip.mission_id else None
    launch = (
        session.get(Launch, mission.launch_id)
        if mission and mission.launch_id
        else None
    )
    trip_boats = crud.get_trip_boats_by_trip_with_boat_provider(
        session=session, trip_id=trip.id
    )
    selected_tb = next(
        (tb for tb in trip_boats if tb.boat_id == first.boat_id),
        None,
    )
    boat = selected_tb.boat if selected_tb else None
    provider = boat.provider if boat else None
    location = (
        session.get(Location, launch.location_id)
        if launch and launch.location_id
        else None
    )
    tz = location.timezone if location else None

    def _dt_iso(dt):
        return dt.isoformat() if hasattr(dt, "isoformat") and dt else None

    check_in_iso = _dt_iso(trip.check_in_time)
    boarding_iso = _dt_iso(trip.boarding_time)
    departure_iso = _dt_iso(trip.departure_time)
    launch_ts_iso = _dt_iso(launch.launch_timestamp) if launch else None

    return {
        "trip_name": (trip.name or "").strip() or None,
        "trip_type": trip.type,
        "departure_time": departure_iso,
        "trip_timezone": tz,
        "check_in_time": check_in_iso,
        "boarding_time": boarding_iso,
        "mission_name": mission.name if mission else None,
        "launch_name": launch.name if launch else None,
        "launch_timestamp": launch_ts_iso,
        "launch_timezone": tz,
        "launch_summary": launch.summary if launch else None,
        "boat_name": boat.name if boat else None,
        "provider_name": provider.name if provider else None,
        "departure_location": provider.address if provider else None,
        "map_link": provider.map_link if provider else None,
        "check_in_display": _format_dt_iso_for_email(check_in_iso, tz),
        "boarding_display": _format_dt_iso_for_email(boarding_iso, tz),
        "departure_display": _format_dt_iso_for_email(departure_iso, tz),
        "launch_time_display": _format_dt_iso_for_email(launch_ts_iso, tz)
        if trip.type == "launch_viewing"
        else None,
    }
