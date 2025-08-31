"""
Booking utilities and shared functions.

This module contains utility functions used across multiple booking endpoints
to avoid code duplication and improve maintainability.
"""

import base64
import io
import logging

import qrcode
from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.core.config import settings
from app.models import Booking, BookingItem, Mission, Trip

# Set up logging
logger = logging.getLogger(__name__)


def generate_qr_code(confirmation_code: str) -> str:
    """
    Generate a QR code for a booking confirmation code and return as base64 string.

    Args:
        confirmation_code: The booking confirmation code

    Returns:
        Base64 encoded PNG image string
    """
    # Use direct frontend URL for better performance (no redirect needed)
    qr_url = f"{settings.FRONTEND_HOST}/bookings?code={confirmation_code}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


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

    # Fetch items
    try:
        items = session.exec(
            select(BookingItem).where(BookingItem.booking_id == booking.id)
        ).all()

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
                "price_per_unit": item.price_per_unit,
            }
        )
    return booking_items
