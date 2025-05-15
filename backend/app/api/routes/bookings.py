import base64
import io
import random
import string
import uuid

import qrcode
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api import deps
from app.core.config import settings
from app.models import (
    Boat,
    Booking,
    BookingCreate,
    BookingItem,
    BookingItemPublic,
    BookingPublic,
    BookingUpdate,
    Mission,
    Trip,
)

router = APIRouter(prefix="/bookings", tags=["bookings"])


def generate_qr_code(confirmation_code: str) -> str:
    """Generate a QR code for a booking confirmation code and return as base64 string."""
    qr_url = f"{settings.QR_CODE_BASE_URL}/check-in?booking={confirmation_code}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# --- Public Endpoints ---


@router.post("/", response_model=BookingPublic, status_code=status.HTTP_201_CREATED)
def create_booking(
    *,
    session: Session = Depends(deps.get_db),
    booking_in: BookingCreate,
) -> BookingPublic:
    """
    Create a new booking (public endpoint).
    """
    # 1. Validate mission exists
    mission = session.get(Mission, booking_in.mission_id)
    if not mission:
        raise HTTPException(
            status_code=400,
            detail=f"Mission with ID {booking_in.mission_id} does not exist",
        )

    # 2. Validate tip is non-negative
    if booking_in.tip_amount < 0:
        raise HTTPException(status_code=400, detail="Tip amount cannot be negative")

    # 3. Validate all referenced trips and boats exist and are active
    for item in booking_in.items:
        trip = session.get(Trip, item.trip_id)
        if not trip or not trip.active:
            raise HTTPException(
                status_code=400,
                detail=f"Trip {item.trip_id} does not exist or is not active",
            )
        boat = session.get(Boat, item.boat_id)
        if not boat:
            raise HTTPException(
                status_code=400, detail=f"Boat {item.boat_id} does not exist"
            )

    # 4. Capacity check (simplified: sum all tickets for each trip/boat, compare to capacity)
    # For MVP, assume no concurrent bookings and no overrides
    for item in booking_in.items:
        # Get max capacity (from trip_boat if exists, else boat)
        from app.models import TripBoat

        trip_boat = session.exec(
            select(TripBoat).where(
                TripBoat.trip_id == item.trip_id, TripBoat.boat_id == item.boat_id
            )
        ).first()
        max_capacity = (
            trip_boat.max_capacity
            if trip_boat and trip_boat.max_capacity
            else boat.capacity
        )
        # Count already booked tickets for this trip/boat
        booked = session.exec(
            select(BookingItem).where(
                BookingItem.trip_id == item.trip_id,
                BookingItem.boat_id == item.boat_id,
                BookingItem.status == "active",
            )
        ).all()
        already_booked = sum(b.quantity for b in booked)
        if already_booked + item.quantity > max_capacity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough capacity for trip {item.trip_id} and boat {item.boat_id}",
            )

    # 5. Generate a unique confirmation code
    def generate_confirmation_code(length=8):
        return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))

    confirmation_code = generate_confirmation_code()
    while session.exec(
        select(Booking).where(Booking.confirmation_code == confirmation_code)
    ).first():
        confirmation_code = generate_confirmation_code()

    # 6. Create Booking instance
    # We need to exclude items to avoid the SQLAlchemy relationship error
    booking_data = booking_in.model_dump(exclude={"items"})
    booking_data["confirmation_code"] = confirmation_code
    booking = Booking(**booking_data)

    try:
        session.add(booking)
        session.commit()
        session.refresh(booking)

        # 7. Create BookingItems
        for item_in in booking_in.items:
            item_data = item_in.model_dump()
            item_data["booking_id"] = booking.id
            booking_item = BookingItem(**item_data)
            session.add(booking_item)
        session.commit()
    except Exception as e:
        session.rollback()
        error_message = str(e)
        # Extract more user-friendly error message if possible
        if "foreign key constraint" in error_message.lower():
            if "booking_mission_id_fkey" in error_message:
                raise HTTPException(
                    status_code=400,
                    detail=f"Mission with ID {booking_in.mission_id} does not exist",
                )
            elif "booking_item_trip_id_fkey" in error_message:
                raise HTTPException(
                    status_code=400, detail="One or more referenced trips do not exist"
                )
            elif "booking_item_boat_id_fkey" in error_message:
                raise HTTPException(
                    status_code=400, detail="One or more referenced boats do not exist"
                )
            else:
                raise HTTPException(
                    status_code=400, detail="Invalid reference to a non-existent entity"
                )
        else:
            raise HTTPException(
                status_code=500, detail="An error occurred while creating the booking"
            )

    # 8. TODO: Integrate payment, email

    # Query items for response
    items = session.exec(
        select(BookingItem).where(BookingItem.booking_id == booking.id)
    ).all()
    booking_public = BookingPublic.model_validate(booking)
    booking_public.items = [BookingItemPublic.model_validate(item) for item in items]

    # Generate QR code
    booking_public.qr_code_base64 = generate_qr_code(booking.confirmation_code)
    return booking_public


@router.get("/{confirmation_code}", response_model=BookingPublic)
def get_booking_by_confirmation_code(
    *,
    session: Session = Depends(deps.get_db),
    confirmation_code: str,
) -> BookingPublic:
    """
    Retrieve a booking by confirmation code (public endpoint).
    """
    booking = session.exec(
        select(Booking).where(Booking.confirmation_code == confirmation_code)
    ).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    items = session.exec(
        select(BookingItem).where(BookingItem.booking_id == booking.id)
    ).all()
    booking_public = BookingPublic.model_validate(booking)
    booking_public.items = [BookingItemPublic.model_validate(item) for item in items]

    # Generate QR code
    booking_public.qr_code_base64 = generate_qr_code(booking.confirmation_code)
    return booking_public


# --- Admin-Restricted Endpoints (use dependency for access control) ---


@router.get(
    "/",
    response_model=list[BookingPublic],
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def list_bookings(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> list[BookingPublic]:
    """
    List/search bookings (admin only).
    """
    bookings = session.exec(select(Booking).offset(skip).limit(limit)).all()
    result = []
    for booking in bookings:
        items = session.exec(
            select(BookingItem).where(BookingItem.booking_id == booking.id)
        ).all()
        booking_public = BookingPublic.model_validate(booking)
        booking_public.items = [
            BookingItemPublic.model_validate(item) for item in items
        ]

        # Generate QR code
        booking_public.qr_code_base64 = generate_qr_code(booking.confirmation_code)
        result.append(booking_public)
    return result


@router.get(
    "/id/{booking_id}",
    response_model=BookingPublic,
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def get_booking_by_id(
    *,
    session: Session = Depends(deps.get_db),
    booking_id: uuid.UUID,
) -> BookingPublic:
    """
    Retrieve booking details by ID (admin only).
    """
    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    items = session.exec(
        select(BookingItem).where(BookingItem.booking_id == booking.id)
    ).all()
    booking_public = BookingPublic.model_validate(booking)
    booking_public.items = [BookingItemPublic.model_validate(item) for item in items]

    # Generate QR code
    booking_public.qr_code_base64 = generate_qr_code(booking.confirmation_code)
    return booking_public


@router.patch(
    "/id/{booking_id}",
    response_model=BookingPublic,
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def update_booking(
    *,
    session: Session = Depends(deps.get_db),
    booking_id: uuid.UUID,
    booking_in: BookingUpdate,
) -> BookingPublic:
    """
    Update booking status or details (admin only).
    """
    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    update_data = booking_in.model_dump(exclude_unset=True)

    # 1. Enforce business rules
    # Disallow updates to items/quantities via PATCH (MVP)
    forbidden_fields = {"items"}
    if any(f in update_data for f in forbidden_fields):
        raise HTTPException(
            status_code=400, detail="Cannot update items or quantities via PATCH"
        )

    # Tip must be non-negative
    if "tip_amount" in update_data and update_data["tip_amount"] is not None:
        if update_data["tip_amount"] < 0:
            raise HTTPException(status_code=400, detail="Tip amount cannot be negative")

    # If status is being updated to cancelled or refunded, update BookingItems
    if "status" in update_data:
        new_status = update_data["status"]
        if new_status in ("cancelled", "refunded"):
            items = session.exec(
                select(BookingItem).where(BookingItem.booking_id == booking.id)
            ).all()
            for item in items:
                item.status = "refunded" if new_status == "refunded" else "active"
                session.add(item)

    # Only update allowed fields
    allowed_fields = {
        "status",
        "special_requests",
        "tip_amount",
        "discount_amount",
        "tax_amount",
        "total_amount",
        "launch_updates_pref",
    }
    for field, value in update_data.items():
        if field in allowed_fields:
            setattr(booking, field, value)
        else:
            raise HTTPException(
                status_code=400, detail=f"Field '{field}' cannot be updated via PATCH"
            )

    session.add(booking)
    session.commit()
    session.refresh(booking)
    items = session.exec(
        select(BookingItem).where(BookingItem.booking_id == booking.id)
    ).all()
    booking_public = BookingPublic.model_validate(booking)
    booking_public.items = [BookingItemPublic.model_validate(item) for item in items]

    # Generate QR code
    booking_public.qr_code_base64 = generate_qr_code(booking.confirmation_code)
    return booking_public
