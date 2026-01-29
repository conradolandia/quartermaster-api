#!/usr/bin/env python
"""
Script to regenerate all QR codes in the database.

QR codes encode the admin check-in URL: {base}/check-in?code={confirmation_code}.
Run this after changing the QR target URL (e.g. from /bookings to /check-in)
so existing stored QR images match the new format.
"""

import logging

from sqlmodel import Session, select

from app.api.routes.bookings import generate_qr_code
from app.core.db import engine
from app.models import Booking

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def update_all_qr_codes():
    """
    Updates all existing QR codes in the database to use direct frontend URLs.
    """
    try:
        with Session(engine) as session:
            # Get count of bookings
            bookings_count = session.exec(select(Booking)).all()
            total = len(bookings_count)
            logger.info(
                f"Updating QR codes for {total} bookings to use direct frontend URLs..."
            )

            # Process in batches to avoid memory issues with large databases
            batch_size = 100
            updated = 0

            for i in range(0, total, batch_size):
                bookings_batch = session.exec(
                    select(Booking).offset(i).limit(batch_size)
                ).all()

                for booking in bookings_batch:
                    # Regenerate the QR code with direct frontend URL
                    booking.qr_code_base64 = generate_qr_code(booking.confirmation_code)
                    session.add(booking)
                    updated += 1

                # Commit after each batch
                session.commit()
                logger.info(f"Updated {updated} of {total} bookings")

            logger.info(
                f"Successfully updated all {updated} QR codes to use direct frontend URLs"
            )

    except Exception as e:
        logger.error(f"Error updating QR codes: {str(e)}")
        raise


if __name__ == "__main__":
    update_all_qr_codes()
