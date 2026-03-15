"""Admin booking endpoints (superuser only)."""

import logging
import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, exists, nulls_first, or_
from sqlmodel import Session, func, select

from app import crud
from app.api import deps
from app.core.config import settings
from app.models import (
    Boat,
    Booking,
    BookingCreate,
    BookingItem,
    BookingItemCreate,
    BookingItemPublic,
    BookingItemQuantityUpdate,
    BookingItemStatus,
    BookingPublic,
    BookingStatus,
    BookingUpdate,
    Launch,
    MerchandiseVariation,
    Mission,
    PaymentStatus,
    Trip,
    User,
)
from app.utils import (
    generate_booking_cancelled_email,
    generate_booking_refunded_email,
    send_email,
)

from .booking_utils import (
    compute_booking_totals,
    generate_qr_code,
    generate_unique_confirmation_code,
    get_booking_items_in_display_order,
)

logger = logging.getLogger(__name__)


class BookingsPaginatedResponse(BaseModel):
    data: list[BookingPublic]
    total: int
    page: int
    per_page: int
    total_pages: int


router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post(
    "/id/{booking_id}/duplicate",
    response_model=BookingPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def duplicate_booking(
    *,
    session: Session = Depends(deps.get_db),
    booking_id: uuid.UUID,
    current_user: User = Depends(deps.get_current_active_superuser),
) -> BookingPublic:
    """
    Duplicate a booking as a new draft (admin only).
    Copies customer data and items; new booking has status draft and a new confirmation code.
    """
    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking {booking_id} not found",
        )
    items = get_booking_items_in_display_order(session, booking.id)
    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking has no items to duplicate",
        )
    confirmation_code = generate_unique_confirmation_code(session)
    booking_in = BookingCreate(
        confirmation_code=confirmation_code,
        first_name=booking.first_name,
        last_name=booking.last_name,
        user_email=booking.user_email,
        user_phone=booking.user_phone,
        billing_address=booking.billing_address,
        subtotal=booking.subtotal,
        discount_amount=booking.discount_amount,
        tax_amount=booking.tax_amount,
        tip_amount=booking.tip_amount,
        total_amount=booking.total_amount,
        special_requests=booking.special_requests,
        launch_updates_pref=booking.launch_updates_pref,
        discount_code_id=booking.discount_code_id,
        admin_notes=booking.admin_notes,
        items=[
            BookingItemCreate(
                trip_id=item.trip_id,
                boat_id=item.boat_id,
                trip_merchandise_id=item.trip_merchandise_id,
                merchandise_variation_id=item.merchandise_variation_id,
                item_type=item.item_type,
                quantity=item.quantity,
                price_per_unit=item.price_per_unit,
                status=BookingItemStatus.active,
                refund_reason=None,
                refund_notes=None,
                variant_option=item.variant_option,
            )
            for item in items
        ],
    )
    created = crud.create_booking_impl(
        session=session,
        booking_in=booking_in,
        current_user=current_user,
    )
    created_items = get_booking_items_in_display_order(session, created.id)
    booking_public = BookingPublic.model_validate(created)
    booking_public.items = [BookingItemPublic.model_validate(i) for i in created_items]
    return booking_public


# --- Admin-Restricted Endpoints (use dependency for access control) ---


@router.get(
    "/",
    response_model=BookingsPaginatedResponse,
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def list_bookings(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    mission_id: uuid.UUID | None = None,
    launch_id: uuid.UUID | None = None,
    trip_id: uuid.UUID | None = None,
    boat_id: uuid.UUID | None = None,
    trip_type: str | None = None,
    booking_status: list[str] | None = Query(None),
    payment_status: list[str] | None = Query(None),
    search: str | None = None,
    sort_by: str = "created_at",
    sort_direction: str = "desc",
    include_archived: bool = False,
) -> BookingsPaginatedResponse:
    """
    List/search bookings (admin only).
    Optionally filter by mission_id, launch_id, trip_id, boat_id, trip_type, booking_status, payment_status.
    booking_status and payment_status accept multiple values (include only those statuses).
    Optional search: filters by confirmation_code, first_name, last_name, user_email, user_phone (case-insensitive). Multiple words are ANDed: each word must appear in at least one of those fields.
    By default exclude bookings that have any item on an archived trip; set include_archived=true to include them.
    """
    try:
        # Parameter validation
        if skip < 0:
            logger.warning(f"Negative skip parameter provided: {skip}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Skip parameter cannot be negative",
            )

        if limit <= 0:
            logger.warning(f"Invalid limit parameter provided: {limit}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Limit parameter must be positive",
            )

        if limit > 500:
            logger.info(f"Limit parameter reduced from {limit} to 500")
            limit = 500  # Cap at 500 to prevent excessive queries

        # Apply text search on confirmation_code, name, email, phone (case-insensitive).
        # Multiple words: each word must match in at least one field (AND across words).
        # e.g. "John Smith" matches first_name="John" + last_name="Smith" or "John Smith" in one field.
        search_term = search.strip() if search else ""
        if search_term:
            terms = [t.strip() for t in search_term.split() if t.strip()]
            if not terms:
                search_cond = None
            else:
                per_term_conds = []
                for term in terms:
                    pattern = f"%{term}%"
                    per_term_conds.append(
                        or_(
                            Booking.confirmation_code.ilike(pattern),
                            Booking.first_name.ilike(pattern),
                            Booking.last_name.ilike(pattern),
                            Booking.user_email.ilike(pattern),
                            Booking.user_phone.ilike(pattern),
                        )
                    )
                search_cond = and_(*per_term_conds)
        else:
            search_cond = None

        # Exclude bookings that have any item on an archived trip (when include_archived=False)
        booking_has_archived_item = exists(
            select(1)
            .select_from(BookingItem)
            .join(Trip, Trip.id == BookingItem.trip_id)
            .where(BookingItem.booking_id == Booking.id)
            .where(Trip.archived == True)  # noqa: E712
        )

        # Build base query
        # When we have join filters (mission/trip/boat/trip_type) AND sort by derived columns
        # (trip_name, trip_type, boat_name, total_quantity), we must avoid SELECT DISTINCT +
        # ORDER BY (expression not in SELECT) - PostgreSQL rejects it.
        # Use a subquery for filtered booking IDs, then select Booking by id.
        has_join_filters = mission_id or launch_id or trip_id or boat_id or trip_type
        sort_by_derived = sort_by in (
            "trip_name",
            "trip_type",
            "boat_name",
            "total_quantity",
        )
        use_id_subquery = has_join_filters and sort_by_derived

        if use_id_subquery:
            # Subquery: distinct booking IDs matching all filters
            id_subq = select(Booking.id).join(
                BookingItem, BookingItem.booking_id == Booking.id
            )
            if mission_id or launch_id or trip_type:
                id_subq = id_subq.join(Trip, Trip.id == BookingItem.trip_id)
                if mission_id:
                    id_subq = id_subq.where(Trip.mission_id == mission_id)
                if launch_id:
                    id_subq = id_subq.join(
                        Mission, Mission.id == Trip.mission_id
                    ).where(Mission.launch_id == launch_id)
                if trip_type:
                    id_subq = id_subq.where(Trip.type == trip_type)
            if trip_id:
                id_subq = id_subq.where(BookingItem.trip_id == trip_id)
            if boat_id:
                id_subq = id_subq.where(BookingItem.boat_id == boat_id)
            if not include_archived:
                id_subq = id_subq.where(~booking_has_archived_item)
            if booking_status:
                id_subq = id_subq.where(Booking.booking_status.in_(booking_status))
            if payment_status:
                id_subq = id_subq.where(Booking.payment_status.in_(payment_status))
            if search_term:
                id_subq = id_subq.where(search_cond)
            id_subq = id_subq.distinct()
            base_query = select(Booking).where(Booking.id.in_(id_subq))
        else:
            base_query = select(Booking)
            if has_join_filters:
                base_query = base_query.join(
                    BookingItem, BookingItem.booking_id == Booking.id
                )
                if mission_id or launch_id or trip_type:
                    base_query = base_query.join(Trip, Trip.id == BookingItem.trip_id)
                    if mission_id:
                        base_query = base_query.where(Trip.mission_id == mission_id)
                    if launch_id:
                        base_query = base_query.join(
                            Mission, Mission.id == Trip.mission_id
                        ).where(Mission.launch_id == launch_id)
                    if trip_type:
                        base_query = base_query.where(Trip.type == trip_type)
                if trip_id:
                    base_query = base_query.where(BookingItem.trip_id == trip_id)
                if boat_id:
                    base_query = base_query.where(BookingItem.boat_id == boat_id)
                base_query = base_query.distinct()
            if not include_archived:
                base_query = base_query.where(~booking_has_archived_item)
            if booking_status:
                base_query = base_query.where(
                    Booking.booking_status.in_(booking_status)
                )
            if payment_status:
                base_query = base_query.where(
                    Booking.payment_status.in_(payment_status)
                )
            if search_term:
                base_query = base_query.where(search_cond)

        if mission_id:
            logger.info(f"Filtering bookings by mission_id: {mission_id}")
        if launch_id:
            logger.info(f"Filtering bookings by launch_id: {launch_id}")
        if trip_id:
            logger.info(f"Filtering bookings by trip_id: {trip_id}")
        if boat_id:
            logger.info(f"Filtering bookings by boat_id: {boat_id}")
        if trip_type:
            logger.info(f"Filtering bookings by trip_type: {trip_type}")
        if booking_status:
            logger.info(f"Filtering bookings by booking_status: {booking_status}")
        if payment_status:
            logger.info(f"Filtering bookings by payment_status: {payment_status}")
        if search_term:
            logger.info(f"Filtering bookings by search: {search_term!r}")

        # Get total count first
        total_count = 0
        try:
            count_query = select(func.count(Booking.id.distinct()))
            if mission_id or launch_id or trip_id or boat_id or trip_type:
                count_query = count_query.select_from(Booking).join(
                    BookingItem, BookingItem.booking_id == Booking.id
                )
                if mission_id or launch_id or trip_type:
                    count_query = count_query.join(Trip, Trip.id == BookingItem.trip_id)
                    if mission_id:
                        count_query = count_query.where(Trip.mission_id == mission_id)
                    if launch_id:
                        count_query = count_query.join(
                            Mission, Mission.id == Trip.mission_id
                        ).where(Mission.launch_id == launch_id)
                    if trip_type:
                        count_query = count_query.where(Trip.type == trip_type)
                if trip_id:
                    count_query = count_query.where(BookingItem.trip_id == trip_id)
                if boat_id:
                    count_query = count_query.where(BookingItem.boat_id == boat_id)
            if booking_status or payment_status:
                if not (mission_id or launch_id or trip_id or boat_id or trip_type):
                    count_query = count_query.select_from(Booking)
            if booking_status:
                count_query = count_query.where(
                    Booking.booking_status.in_(booking_status)
                )
            if payment_status:
                count_query = count_query.where(
                    Booking.payment_status.in_(payment_status)
                )
            if search_term:
                count_query = count_query.where(search_cond)
            if not include_archived:
                count_query = count_query.where(~booking_has_archived_item)
            total_count = session.exec(count_query).first()
            logger.info(f"Total bookings count: {total_count}")
        except Exception as e:
            logger.error(f"Error counting bookings: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error counting bookings",
            )

        # Apply sorting for derived columns (trip, boat, total quantity)
        if sort_by == "trip_name" or sort_by == "trip_type":
            # Correlated subquery: trip name/type of first booking item (display order)
            first_item_trip = (
                select(Trip.name if sort_by == "trip_name" else Trip.type)
                .select_from(BookingItem)
                .join(Trip, Trip.id == BookingItem.trip_id)
                .where(BookingItem.booking_id == Booking.id)
                .order_by(
                    nulls_first(BookingItem.trip_merchandise_id.asc()),
                    BookingItem.item_type,
                    BookingItem.id,
                )
                .limit(1)
                .correlate(Booking)
                .scalar_subquery()
            )
            if sort_direction.lower() == "asc":
                order_clause = first_item_trip.asc().nulls_last()
            else:
                order_clause = first_item_trip.desc().nulls_first()
        elif sort_by == "boat_name":
            # Correlated subquery: boat name of first booking item (display order)
            first_item_boat = (
                select(Boat.name)
                .select_from(BookingItem)
                .join(Boat, Boat.id == BookingItem.boat_id)
                .where(BookingItem.booking_id == Booking.id)
                .order_by(
                    nulls_first(BookingItem.trip_merchandise_id.asc()),
                    BookingItem.item_type,
                    BookingItem.id,
                )
                .limit(1)
                .correlate(Booking)
                .scalar_subquery()
            )
            if sort_direction.lower() == "asc":
                order_clause = first_item_boat.asc().nulls_last()
            else:
                order_clause = first_item_boat.desc().nulls_first()
        elif sort_by == "total_quantity":
            # Correlated subquery: sum of ticket quantities (exclude merchandise)
            total_qty_subq = (
                select(func.coalesce(func.sum(BookingItem.quantity), 0))
                .select_from(BookingItem)
                .where(BookingItem.booking_id == Booking.id)
                .where(BookingItem.trip_merchandise_id.is_(None))
                .correlate(Booking)
                .scalar_subquery()
            )
            if sort_direction.lower() == "asc":
                order_clause = total_qty_subq.asc()
            else:
                order_clause = total_qty_subq.desc()
        else:
            sort_column = getattr(Booking, sort_by, Booking.created_at)
            if sort_direction.lower() == "asc":
                order_clause = sort_column.asc()
            else:
                order_clause = sort_column.desc()

        # Fetch bookings with sorting
        bookings = []
        try:
            bookings = session.exec(
                base_query.order_by(order_clause).offset(skip).limit(limit)
            ).all()
            logger.info(
                f"Retrieved {len(bookings)} bookings (skip={skip}, limit={limit}, sort_by={sort_by}, sort_direction={sort_direction})"
            )
        except Exception as e:
            logger.error(f"Database error in list_bookings: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error retrieving bookings from database",
            )

        result = []
        qr_code_updates = []

        # Process each booking
        for booking in bookings:
            try:
                items = get_booking_items_in_display_order(session, booking.id)
                booking_public = BookingPublic.model_validate(booking)
                booking_public.items = [
                    BookingItemPublic.model_validate(item) for item in items
                ]

                # Get mission and trip information from first booking item
                if items and len(items) > 0:
                    trip = session.get(Trip, items[0].trip_id)
                    if trip:
                        booking_public.mission_id = trip.mission_id
                        booking_public.trip_name = trip.name
                        booking_public.trip_type = trip.type
                        mission = session.get(Mission, trip.mission_id)
                        if mission:
                            booking_public.mission_name = mission.name

                # Flag bookings missing QR codes for batch update
                if not booking.qr_code_base64:
                    qr_code_updates.append(booking)

                result.append(booking_public)

            except Exception as e:
                # Log error but continue processing other bookings
                logger.error(f"Error processing booking {booking.id}: {str(e)}")
                continue

        # Batch update QR codes if needed
        if qr_code_updates:
            logger.info(
                f"Generating missing QR codes for {len(qr_code_updates)} bookings"
            )
            try:
                for booking in qr_code_updates:
                    booking.qr_code_base64 = generate_qr_code(booking.confirmation_code)
                    session.add(booking)
                session.commit()
            except Exception as e:
                logger.error(f"Error generating QR codes: {str(e)}")
                # Continue even if QR code generation fails
                session.rollback()

        # Return both data and total count for pagination
        return BookingsPaginatedResponse(
            data=result,
            total=total_count,
            page=(skip // limit) + 1,
            per_page=limit,
            total_pages=(total_count + limit - 1) // limit,  # Ceiling division
        )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch any unexpected exceptions
        logger.exception(f"Unexpected error in list_bookings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again later.",
        )


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
    try:
        # Fetch booking
        booking = session.get(Booking, booking_id)
        if not booking:
            logger.info(f"Booking not found with ID: {booking_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Booking with ID {booking_id} not found",
            )

        # Fetch items in display order (tickets first, then merch)
        items = []
        try:
            items = get_booking_items_in_display_order(session, booking.id)

            if not items:
                logger.warning(f"Booking {booking_id} has no items")
        except Exception as e:
            logger.error(f"Error retrieving items for booking {booking_id}: {str(e)}")
            # Continue without items rather than failing completely

        # Prepare response
        booking_public = BookingPublic.model_validate(booking)
        booking_public.items = [
            BookingItemPublic.model_validate(item) for item in items
        ]

        # Handle QR code generation
        if not booking.qr_code_base64:
            try:
                logger.info(f"Generating missing QR code for booking: {booking.id}")
                booking.qr_code_base64 = generate_qr_code(booking.confirmation_code)
                session.add(booking)
                session.commit()
            except Exception as e:
                logger.error(
                    f"Failed to generate QR code for booking {booking.id}: {str(e)}"
                )
                # Continue even if QR code generation fails
                session.rollback()

        return booking_public

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch any unexpected exceptions
        logger.exception(f"Unexpected error retrieving booking {booking_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again later.",
        )


@router.delete(
    "/id/{booking_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(deps.get_current_active_superuser)],
    operation_id="bookings_delete_booking",
)
def delete_booking(
    *,
    session: Session = Depends(deps.get_db),
    booking_id: uuid.UUID,
) -> None:
    """
    Permanently delete a booking and its items (admin only).

    Returns merchandise inventory (quantity_sold / quantity_fulfilled) to
    the relevant variations. This action cannot be undone.
    """
    booking = session.get(Booking, booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking with ID {booking_id} not found",
        )
    items = list(
        session.exec(
            select(BookingItem).where(BookingItem.booking_id == booking.id)
        ).all()
    )
    for item in items:
        if item.merchandise_variation_id:
            variation = session.get(MerchandiseVariation, item.merchandise_variation_id)
            if variation:
                variation.quantity_sold -= item.quantity
                variation.quantity_sold = max(0, variation.quantity_sold)
                if item.status == BookingItemStatus.fulfilled:
                    variation.quantity_fulfilled -= item.quantity
                    variation.quantity_fulfilled = max(0, variation.quantity_fulfilled)
                session.add(variation)
    session.delete(booking)
    session.commit()
    logger.info(
        f"Deleted booking {booking_id} (confirmation: {booking.confirmation_code})"
    )


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
    try:
        # Validate input data
        update_data = booking_in.model_dump(exclude_unset=True)
        if not update_data:
            logger.warning(f"Empty update request for booking {booking_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No update data provided",
            )

        # Fetch the booking
        booking = session.get(Booking, booking_id)
        if not booking:
            logger.warning(f"Attempt to update non-existent booking: {booking_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Booking with ID {booking_id} not found",
            )

        if booking.booking_status == BookingStatus.checked_in:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update a checked-in booking",
            )

        # 1. Enforce business rules
        # Disallow updates to items (raw) via PATCH; item_quantity_updates handled below
        forbidden_fields = {
            "items",
            "confirmation_code",
            "mission_id",
            "payment_intent_id",
        }
        invalid_fields = [f for f in forbidden_fields if f in update_data]
        if invalid_fields:
            logger.warning(
                f"Attempt to update forbidden fields: {', '.join(invalid_fields)}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot update these fields via PATCH: {', '.join(invalid_fields)}",
            )

        # Process item quantity updates (checked_in already rejected above)
        # Use booking_in (Pydantic model) so we get objects
        # and pop from update_data so it is not applied as a booking field
        item_quantity_updates: list[BookingItemQuantityUpdate] | None = getattr(
            booking_in, "item_quantity_updates", None
        )
        update_data.pop("item_quantity_updates", None)
        if item_quantity_updates:
            items = session.exec(
                select(BookingItem).where(BookingItem.booking_id == booking.id)
            ).all()
            qty_by_id = {u.id: u.quantity for u in item_quantity_updates}
            for u in item_quantity_updates:
                item = session.get(BookingItem, u.id)
                if not item or item.booking_id != booking.id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Booking item {u.id} not found or does not belong to this booking",
                    )
            # Validate ticket capacity with proposed quantities
            ticket_totals: dict[tuple[uuid.UUID, uuid.UUID, str], int] = defaultdict(
                int
            )
            for item in items:
                if item.trip_merchandise_id is None:
                    qty = qty_by_id.get(item.id, item.quantity)
                    ticket_totals[(item.trip_id, item.boat_id, item.item_type)] += qty
            # This booking's current ticket count per (boat_id, item_type); paid includes it, so subtract before adding proposed qty
            current_this_booking: dict[tuple[uuid.UUID, str], int] = defaultdict(int)
            for item in items:
                if item.trip_merchandise_id is None:
                    current_this_booking[
                        (item.boat_id, item.item_type)
                    ] += item.quantity
            for (trip_id, boat_id, item_type), qty in ticket_totals.items():
                capacities = crud.get_effective_capacity_per_ticket_type(
                    session=session, trip_id=trip_id, boat_id=boat_id
                )
                cap = capacities.get(item_type)
                if cap is None and item_type not in capacities:
                    boat = session.get(Boat, boat_id)
                    boat_name = boat.name if boat else str(boat_id)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"No capacity for ticket type '{item_type}' on boat '{boat_name}'",
                    )
                if cap is not None:
                    paid = crud.get_paid_ticket_count_per_boat_per_item_type_for_trip(
                        session=session, trip_id=trip_id
                    ).get((boat_id, item_type), 0)
                    paid_excluding_this = paid - current_this_booking.get(
                        (boat_id, item_type), 0
                    )
                    if paid_excluding_this + qty > cap:
                        boat = session.get(Boat, boat_id)
                        boat_name = boat.name if boat else str(boat_id)
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Boat '{boat_name}' capacity for '{item_type}' would be exceeded",
                        )
            # Apply quantity updates and merchandise inventory; quantity 0 removes the item
            for u in item_quantity_updates:
                item = session.get(BookingItem, u.id)
                if not item:
                    continue
                old_qty = item.quantity
                new_qty = u.quantity
                if new_qty == old_qty:
                    continue
                if item.merchandise_variation_id:
                    variation = session.get(
                        MerchandiseVariation, item.merchandise_variation_id
                    )
                    if variation:
                        delta = new_qty - old_qty
                        if delta > 0:
                            available = (
                                variation.quantity_total - variation.quantity_sold
                            )
                            if available < delta:
                                raise HTTPException(
                                    status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=f"Insufficient merchandise inventory for item {item.item_type}",
                                )
                            variation.quantity_sold += delta
                        else:
                            variation.quantity_sold -= abs(delta)
                            variation.quantity_sold = max(0, variation.quantity_sold)
                        session.add(variation)
                if new_qty == 0:
                    session.delete(item)
                else:
                    item.quantity = new_qty
                    session.add(item)
            # Recompute booking subtotal (0-qty items contribute 0; they were deleted)
            new_subtotal = sum(
                (qty_by_id.get(item.id, item.quantity) * item.price_per_unit)
                for item in items
            )
            booking.subtotal = new_subtotal
            session.add(booking)
            # Recompute tax and total from mission's jurisdiction (mission -> launch -> location -> jurisdiction)
            trip = None
            for item in items:
                if qty_by_id.get(item.id, item.quantity) > 0:
                    trip = session.get(Trip, item.trip_id)
                    break
            if trip:
                mission = session.get(Mission, trip.mission_id)
                launch = session.get(Launch, mission.launch_id) if mission else None
                tax_rate: float | None = None
                if launch is not None:
                    jurisdictions = crud.get_jurisdictions_by_location(
                        session=session, location_id=launch.location_id, limit=1
                    )
                    if jurisdictions:
                        tax_rate = jurisdictions[0].sales_tax_rate
                if tax_rate is not None:
                    new_tax, new_total = compute_booking_totals(
                        new_subtotal,
                        booking.discount_amount,
                        tax_rate,
                        booking.tip_amount,
                    )
                    update_data["tax_amount"] = new_tax
                    update_data["total_amount"] = new_total
            else:
                # All items removed; zero out tax and total
                update_data["tax_amount"] = 0
                update_data["total_amount"] = 0

        # Validate booking_status and payment_status transitions
        booking_status_changed = False
        new_booking_status = None
        old_booking_status = booking.booking_status

        if "booking_status" in update_data:
            new_booking_status = update_data["booking_status"]
            if new_booking_status != old_booking_status:
                booking_status_changed = True
                valid_transitions = {
                    BookingStatus.draft: [
                        BookingStatus.confirmed,
                        BookingStatus.cancelled,
                    ],
                    BookingStatus.confirmed: [
                        BookingStatus.checked_in,
                        BookingStatus.cancelled,
                    ],
                    BookingStatus.checked_in: [
                        BookingStatus.completed,
                        BookingStatus.cancelled,
                    ],
                    BookingStatus.completed: [BookingStatus.cancelled],
                    BookingStatus.cancelled: [],
                }
                allowed_next = valid_transitions.get(old_booking_status, [])
                if new_booking_status not in allowed_next:
                    logger.warning(
                        f"Invalid booking_status transition for booking {booking_id}: "
                        f"{old_booking_status} -> {new_booking_status}"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot transition from '{old_booking_status}' to '{new_booking_status}'",
                    )

        # Tip must be non-negative
        if "tip_amount" in update_data and update_data["tip_amount"] is not None:
            if update_data["tip_amount"] < 0:
                logger.warning(
                    f"Negative tip amount in update: {update_data['tip_amount']}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tip amount cannot be negative",
                )

        # If booking_status is being updated to cancelled, set all items to refunded or cancelled
        if "booking_status" in update_data:
            new_booking_status = update_data["booking_status"]
            new_payment_status = (
                update_data.get("payment_status") or booking.payment_status
            )
            if new_booking_status == BookingStatus.cancelled:
                try:
                    items = session.exec(
                        select(BookingItem).where(BookingItem.booking_id == booking.id)
                    ).all()

                    if not items:
                        logger.warning(
                            f"No items found for booking {booking_id} during status update"
                        )

                    for item in items:
                        item.status = (
                            BookingItemStatus.refunded
                            if new_payment_status
                            in (
                                PaymentStatus.refunded,
                                PaymentStatus.partially_refunded,
                            )
                            else BookingItemStatus.cancelled
                        )
                        session.add(item)
                except Exception as e:
                    logger.error(
                        f"Error updating booking items for {booking_id}: {str(e)}"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to update booking items status",
                    )

        # Only update allowed fields
        allowed_fields = {
            "booking_status",
            "payment_status",
            "special_requests",
            "tip_amount",
            "discount_amount",
            "tax_amount",
            "total_amount",
            "launch_updates_pref",
            "first_name",
            "last_name",
            "user_email",
            "user_phone",
            "billing_address",
            "admin_notes",
        }

        # Check for any fields that are not allowed
        invalid_fields = [f for f in update_data.keys() if f not in allowed_fields]
        if invalid_fields:
            logger.warning(
                f"Attempt to update invalid fields: {', '.join(invalid_fields)}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fields not allowed for update: {', '.join(invalid_fields)}",
            )

        # Apply updates to allowed fields
        for field, value in update_data.items():
            setattr(booking, field, value)

        try:
            session.add(booking)
            session.commit()
            session.refresh(booking)
            logger.info(f"Successfully updated booking {booking_id}")

            # Send email notifications if booking_status changed to cancelled
            if (
                booking_status_changed
                and settings.emails_enabled
                and new_booking_status == BookingStatus.cancelled
            ):
                try:
                    # Get mission name
                    mission = session.get(Mission, booking.mission_id)
                    mission_name = mission.name if mission else "Unknown Mission"
                    is_refund = booking.payment_status in (
                        PaymentStatus.refunded,
                        PaymentStatus.partially_refunded,
                    )

                    if is_refund:
                        # Send refund confirmation email
                        email_data = generate_booking_refunded_email(
                            email_to=booking.user_email,
                            user_name=f"{booking.first_name} {booking.last_name}".strip(),
                            confirmation_code=booking.confirmation_code,
                            mission_name=mission_name,
                            refund_amount=booking.total_amount
                            / 100.0,  # cents to dollars for display
                        )

                        send_email(
                            email_to=booking.user_email,
                            subject=email_data.subject,
                            html_content=email_data.html_content,
                        )

                        logger.info(
                            f"Booking refund email sent to {booking.user_email}"
                        )
                    else:
                        # Send cancellation email (e.g. failed payment)
                        email_data = generate_booking_cancelled_email(
                            email_to=booking.user_email,
                            user_name=f"{booking.first_name} {booking.last_name}".strip(),
                            confirmation_code=booking.confirmation_code,
                            mission_name=mission_name,
                        )

                        send_email(
                            email_to=booking.user_email,
                            subject=email_data.subject,
                            html_content=email_data.html_content,
                        )

                        logger.info(
                            f"Booking cancellation email sent to {booking.user_email}"
                        )

                except Exception as e:
                    # Don't fail the booking update if email sending fails
                    logger.error(
                        f"Failed to send booking status update email: {str(e)}"
                    )

            items = get_booking_items_in_display_order(session, booking.id)
            booking_public = BookingPublic.model_validate(booking)
            booking_public.items = [
                BookingItemPublic.model_validate(item) for item in items
            ]

            # Generate QR code if it doesn't exist
            if not booking.qr_code_base64:
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

            return booking_public

        except Exception as e:
            session.rollback()
            logger.error(f"Database error during booking update: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An error occurred while updating the booking",
            )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch any unexpected exceptions
        logger.exception(f"Unexpected error updating booking {booking_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again later.",
        )
