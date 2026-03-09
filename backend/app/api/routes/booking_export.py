"""Booking CSV export endpoint."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlmodel import Session, select

from app import crud
from app.api import deps
from app.models import (
    Boat,
    Booking,
    BookingItem,
    Trip,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get(
    "/export/csv",
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def export_bookings_csv(
    *,
    session: Session = Depends(deps.get_db),
    mission_id: str | None = None,
    trip_id: str | None = None,
    boat_id: str | None = None,
    booking_status: str | None = None,
    fields: str | None = None,  # Comma-separated list of field names
) -> Response:
    """
    Export bookings data to CSV format.

    Supports filtering by mission_id, trip_id, boat_id, and booking_status.
    Supports field selection via the fields parameter (comma-separated list of field names).
    Available fields: confirmation_code, customer_name, email, phone, billing_address,
    booking_status, payment_status, total_amount, subtotal, discount_amount, tax_amount, tip_amount, created_at,
    trip_type, boat_name; ticket_types (or ticket_types_quantity, ticket_types_price,
    ticket_types_total); swag (or swag_description, swag_total).

    When ticket-type columns are requested (ticket_types, ticket_types_quantity, etc.),
    trip_id should be provided. The ticket-type columns will be derived from that trip's
    effective pricing (BoatPricing + TripBoatPricing across boats on the trip).
    Booking items will be matched to the trip's ticket types (with backward compatibility
    for legacy naming variants like "adult" vs "adult_ticket").
    """
    try:
        import csv
        import io

        from fastapi.responses import Response

        # Build query
        query = select(Booking)

        # Apply filters
        conditions = []

        if mission_id or trip_id or boat_id:
            # Join with BookingItem if we need to filter by mission, trip, or boat
            query = query.join(BookingItem)

            if mission_id:
                conditions.append(BookingItem.trip.has(Trip.mission_id == mission_id))
            if trip_id:
                conditions.append(BookingItem.trip_id == trip_id)
            if boat_id:
                try:
                    conditions.append(BookingItem.boat_id == uuid.UUID(boat_id))
                except (ValueError, TypeError):
                    pass

        if booking_status:
            conditions.append(Booking.booking_status == booking_status)

        # Apply all conditions
        if conditions:
            query = query.where(*conditions)

        # Execute query
        bookings = session.exec(query).all()

        # Check if ticket-type columns are requested
        will_include_ticket_types = (
            fields
            and any(
                f in fields.split(",")
                for f in [
                    "ticket_types",
                    "ticket_types_quantity",
                    "ticket_types_price",
                    "ticket_types_total",
                ]
            )
            or (not fields)
        )  # Default includes ticket_types

        # Determine ticket types: from effective pricing if trip_id (and optionally boat_id) provided, else from booking items
        if trip_id and will_include_ticket_types:
            if boat_id:
                try:
                    trip_uuid = uuid.UUID(trip_id)
                    boat_uuid = uuid.UUID(boat_id)
                except (ValueError, TypeError):
                    trip_uuid = boat_uuid = None
                if trip_uuid and boat_uuid:
                    pricing = crud.get_effective_pricing(
                        session=session,
                        trip_id=trip_uuid,
                        boat_id=boat_uuid,
                    )
                    sorted_ticket_types = [p.ticket_type for p in pricing]
                else:
                    sorted_ticket_types = crud.get_effective_ticket_types_for_trip(
                        session=session, trip_id=uuid.UUID(trip_id)
                    )
            else:
                sorted_ticket_types = crud.get_effective_ticket_types_for_trip(
                    session=session, trip_id=uuid.UUID(trip_id)
                )
        else:
            # Fallback: collect from booking items (for exports without trip selection)
            def normalize_ticket_type(raw: str) -> str:
                """Normalize ticket type names: remove '_ticket' suffix to merge legacy variants."""
                if raw.endswith("_ticket"):
                    return raw[:-7]
                return raw

            all_ticket_types: set[str] = set()
            for booking in bookings:
                items = session.exec(
                    select(BookingItem).where(BookingItem.booking_id == booking.id)
                ).all()
                for item in items:
                    if item.trip_merchandise_id is None:
                        all_ticket_types.add(normalize_ticket_type(item.item_type))
            sorted_ticket_types = sorted(all_ticket_types)

        def match_item_to_ticket_type(
            item_type: str, trip_ticket_types: list[str]
        ) -> str | None:
            """Match booking item_type to a trip's ticket type (with backward compatibility).

            Returns the matching trip ticket_type, or None if no match.
            """
            # Direct match
            if item_type in trip_ticket_types:
                return item_type
            # Try with _ticket suffix removed (legacy: item_type="adult" matches trip_ticket_type="adult_ticket")
            if item_type.endswith("_ticket"):
                base = item_type[:-7]
                if base in trip_ticket_types:
                    return base
            # Try adding _ticket suffix (legacy: item_type="adult" matches trip_ticket_type="adult_ticket")
            with_suffix = f"{item_type}_ticket"
            if with_suffix in trip_ticket_types:
                return with_suffix
            return None

        # Define all available fields
        base_fields = {
            "confirmation_code": "Confirmation Code",
            "customer_name": "Customer Name",
            "email": "Email",
            "phone": "Phone",
            "billing_address": "Billing Address",
            "status": "Status",
            "total_amount": "Total Amount",
            "subtotal": "Subtotal",
            "discount_amount": "Discount Amount",
            "tax_amount": "Tax Amount",
            "tip_amount": "Tip Amount",
            "created_at": "Created At",
            "trip_type": "Trip Type",
            "boat_name": "Boat Name",
        }

        # Parse fields parameter
        selected_fields: list[str] = []
        if fields:
            selected_fields = [f.strip() for f in fields.split(",") if f.strip()]
        else:
            # If no fields specified, include all fields
            selected_fields = list(base_fields.keys()) + ["ticket_types", "swag"]

        # Validate selected fields; support granular ticket_types and swag
        valid_fields = set(base_fields.keys()) | {
            "ticket_types",
            "ticket_types_quantity",
            "ticket_types_price",
            "ticket_types_total",
            "swag",
            "swag_description",
            "swag_total",
        }
        selected_fields = [f for f in selected_fields if f in valid_fields]

        # If no valid fields selected, use all fields
        if not selected_fields:
            selected_fields = list(base_fields.keys()) + ["ticket_types", "swag"]

        # When boat is specified, boat name column is redundant (same boat for all rows)
        if boat_id:
            selected_fields = [f for f in selected_fields if f != "boat_name"]

        # Which ticket/swag sub-columns to include
        include_ticket_quantity = (
            "ticket_types" in selected_fields
            or "ticket_types_quantity" in selected_fields
        )
        include_ticket_price = (
            "ticket_types" in selected_fields or "ticket_types_price" in selected_fields
        )
        include_ticket_total = (
            "ticket_types" in selected_fields or "ticket_types_total" in selected_fields
        )
        include_swag_description = (
            "swag" in selected_fields or "swag_description" in selected_fields
        )
        include_swag_total = (
            "swag" in selected_fields or "swag_total" in selected_fields
        )

        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)

        # Build header: base fields in order, then ticket columns, then swag
        header = []
        for field_key in selected_fields:
            if field_key in base_fields:
                header.append(base_fields[field_key])
        if include_ticket_quantity or include_ticket_price or include_ticket_total:
            for ticket_type in sorted_ticket_types:
                if include_ticket_quantity:
                    header.append(f"{ticket_type} Quantity")
                if include_ticket_price:
                    header.append(f"{ticket_type} Price")
                if include_ticket_total:
                    header.append(f"{ticket_type} Total")
        if include_swag_description:
            header.append("Swag Description")
        if include_swag_total:
            header.append("Swag Total")

        writer.writerow(header)

        # Write booking data - one row per booking
        for booking in bookings:
            # Get booking items (filter by trip_id and boat_id when provided)
            item_query = select(BookingItem).where(BookingItem.booking_id == booking.id)
            if trip_id:
                item_query = item_query.where(BookingItem.trip_id == trip_id)
            if boat_id:
                try:
                    boat_uuid = uuid.UUID(boat_id)
                    item_query = item_query.where(BookingItem.boat_id == boat_uuid)
                except (ValueError, TypeError):
                    pass
            items = session.exec(item_query).all()

            # Aggregate items by type
            tickets: dict[
                str, dict[str, int]
            ] = {}  # ticket_type -> {qty, price (cents)}
            swag_items: list[str] = []
            swag_total = 0.0

            trip_type = ""
            boat_name = ""

            for item in items:
                # Get trip and boat info from first item
                if not trip_type:
                    trip = session.get(Trip, item.trip_id)
                    if trip:
                        trip_type = trip.type
                if not boat_name:
                    boat = session.get(Boat, item.boat_id)
                    if boat:
                        boat_name = boat.name

                # Group items by type
                # Merchandise items have trip_merchandise_id set
                if item.trip_merchandise_id:
                    # Merchandise item - item_type contains the merchandise name
                    merch_name = item.item_type
                    if item.variant_option:
                        merch_name = f"{merch_name} – {item.variant_option}"
                    swag_items.append(
                        f"{merch_name} x{item.quantity}"
                        if item.quantity > 1
                        else merch_name
                    )
                    swag_total += item.price_per_unit * item.quantity
                else:
                    # Ticket item - match to trip's ticket types if trip_id provided
                    if trip_id and will_include_ticket_types:
                        # Match item_type to trip's ticket type (with backward compatibility)
                        matched_type = match_item_to_ticket_type(
                            item.item_type, sorted_ticket_types
                        )
                        if matched_type:
                            if matched_type not in tickets:
                                tickets[matched_type] = {
                                    "qty": 0,
                                    "price": 0,
                                }  # price in cents
                            tickets[matched_type]["qty"] += item.quantity
                            tickets[matched_type]["price"] += (
                                item.price_per_unit * item.quantity
                            )
                    else:
                        # Fallback: normalize for exports without trip selection
                        def normalize_ticket_type(raw: str) -> str:
                            if raw.endswith("_ticket"):
                                return raw[:-7]
                            return raw

                        normalized_type = normalize_ticket_type(item.item_type)
                        if normalized_type not in tickets:
                            tickets[normalized_type] = {
                                "qty": 0,
                                "price": 0,
                            }  # price in cents
                        tickets[normalized_type]["qty"] += item.quantity
                        tickets[normalized_type]["price"] += (
                            item.price_per_unit * item.quantity
                        )

            # Build row data based on selected fields (amounts in dollars for CSV display)
            row = []
            field_data = {
                "confirmation_code": booking.confirmation_code,
                "customer_name": f"{booking.first_name} {booking.last_name}".strip(),
                "email": booking.user_email,
                "phone": booking.user_phone,
                "billing_address": booking.billing_address,
                "booking_status": booking.booking_status,
                "payment_status": booking.payment_status,
                "total_amount": round(booking.total_amount / 100, 2),
                "subtotal": round(booking.subtotal / 100, 2),
                "discount_amount": round(booking.discount_amount / 100, 2),
                "tax_amount": round(booking.tax_amount / 100, 2),
                "tip_amount": round(booking.tip_amount / 100, 2),
                "created_at": booking.created_at.isoformat(),
                "trip_type": trip_type,
                "boat_name": boat_name,
            }

            # Base fields in selected order
            for field_key in selected_fields:
                if field_key in field_data:
                    row.append(field_data[field_key])
            # Ticket columns (same order as header)
            if include_ticket_quantity or include_ticket_price or include_ticket_total:
                for ticket_type in sorted_ticket_types:
                    if ticket_type in tickets:
                        data = tickets[ticket_type]
                        if include_ticket_quantity:
                            row.append(data["qty"])
                        if include_ticket_price:
                            row.append(
                                f"{data['price'] / data['qty'] / 100:.2f}"
                                if data["qty"] > 0
                                else "0.00"
                            )
                        if include_ticket_total:
                            row.append(f"{data['price'] / 100:.2f}")
                    else:
                        if include_ticket_quantity:
                            row.append("")
                        if include_ticket_price:
                            row.append("")
                        if include_ticket_total:
                            row.append("")
            # Swag columns
            if include_swag_description:
                row.append(", ".join(swag_items) if swag_items else "")
            if include_swag_total:
                row.append(f"{swag_total / 100:.2f}" if swag_total else "")

            writer.writerow(row)

        # Get CSV content
        csv_content = output.getvalue()
        output.close()

        # Create response
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=bookings_export.csv"},
        )

    except Exception as e:
        logger.exception(f"Error exporting bookings CSV: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while exporting data. Please try again later.",
        )
