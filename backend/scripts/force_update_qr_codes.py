#!/usr/bin/env python
"""
Script to force regenerate all QR codes (check-in URL format).

Clears existing qr_code_base64 and regenerates so every booking has a QR
encoding {base}/check-in?code={confirmation_code}. Use when migrating to
the check-in URL format or after changing QR_CODE_BASE_URL.
"""

import logging

from sqlmodel import Session, select

from app.api.routes.bookings import generate_qr_code
from app.core.db import engine
from app.models import Booking

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def force_update_all_qr_codes():
    """
    Force regenerate all QR codes with direct frontend URLs.
    Clears existing codes first to ensure fresh generation.
    """
    try:
        with Session(engine) as session:
            # Get all bookings
            bookings = session.exec(select(Booking)).all()
            total = len(bookings)
            logger.info(f"Force updating QR codes for {total} bookings...")

            # Process each booking
            updated = 0
            for booking in bookings:
                # Clear existing QR code first
                booking.qr_code_base64 = None

                # Generate new QR code with direct frontend URL
                new_qr_code = generate_qr_code(booking.confirmation_code)
                booking.qr_code_base64 = new_qr_code

                session.add(booking)
                updated += 1

                logger.info(
                    f"Updated QR code for booking {booking.confirmation_code} ({updated}/{total})"
                )

            # Commit all changes
            session.commit()

            logger.info(
                f"Successfully force updated all {updated} QR codes with direct frontend URLs"
            )

            # Verify the update
            logger.info("Verifying updates...")
            for booking in bookings:
                session.refresh(booking)
                if booking.qr_code_base64:
                    logger.info(
                        f"✓ Booking {booking.confirmation_code}: QR code updated"
                    )
                else:
                    logger.warning(
                        f"✗ Booking {booking.confirmation_code}: QR code missing"
                    )

    except Exception as e:
        logger.error(f"Error force updating QR codes: {str(e)}")
        raise


if __name__ == "__main__":
    force_update_all_qr_codes()
