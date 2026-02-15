"""
Effective pricing and capacity: BoatPricing defaults merged with TripBoatPricing overrides per (trip_id, boat_id).
"""

import uuid

from sqlmodel import Session, select

from app.models import (
    BoatPricing,
    EffectivePricingItem,
    TripBoat,
    TripBoatPricing,
)


def get_effective_capacity_per_ticket_type(
    *,
    session: Session,
    trip_id: uuid.UUID,
    boat_id: uuid.UUID,
) -> dict[str, int]:
    """
    Return effective capacity per ticket type for (trip_id, boat_id).
    When use_only_trip_pricing: only TripBoatPricing applies.
    Otherwise: TripBoatPricing.capacity overrides BoatPricing.capacity when set.
    """
    trip_boat = session.exec(
        select(TripBoat).where(
            TripBoat.trip_id == trip_id,
            TripBoat.boat_id == boat_id,
        )
    ).first()
    if not trip_boat:
        return {}

    trip_boat_pricing = session.exec(
        select(TripBoatPricing).where(TripBoatPricing.trip_boat_id == trip_boat.id)
    ).all()

    if getattr(trip_boat, "use_only_trip_pricing", False):
        return {
            tbp.ticket_type: tbp.capacity
            for tbp in trip_boat_pricing
            if tbp.capacity is not None
        }

    boat_pricing = session.exec(
        select(BoatPricing).where(BoatPricing.boat_id == boat_id)
    ).all()
    by_type_boat_cap: dict[str, int] = {
        bp.ticket_type: bp.capacity for bp in boat_pricing
    }
    by_type_trip_cap: dict[str, int] = {}
    for tbp in trip_boat_pricing:
        if tbp.capacity is not None:
            by_type_trip_cap[tbp.ticket_type] = tbp.capacity
    all_types = set(by_type_boat_cap) | set(by_type_trip_cap)
    result: dict[str, int] = {}
    for ticket_type in all_types:
        cap = (
            by_type_trip_cap[ticket_type]
            if ticket_type in by_type_trip_cap
            else by_type_boat_cap.get(ticket_type)
        )
        if cap is not None:
            result[ticket_type] = cap
    return result


def get_effective_pricing(
    *,
    session: Session,
    trip_id: uuid.UUID,
    boat_id: uuid.UUID,
    paid_by_type: dict[tuple[uuid.UUID, str], int] | None = None,
) -> list[EffectivePricingItem]:
    """
    Return effective ticket types, prices, capacity and remaining for (trip_id, boat_id).
    When use_only_trip_pricing: only TripBoatPricing applies.
    Otherwise: Boat defaults (BoatPricing) merged with per-trip overrides (TripBoatPricing).
    paid_by_type: (boat_id, item_type) -> count of paid tickets; if None, remaining = capacity.
    """
    trip_boat = session.exec(
        select(TripBoat).where(
            TripBoat.trip_id == trip_id,
            TripBoat.boat_id == boat_id,
        )
    ).first()
    if not trip_boat:
        return []

    trip_boat_pricing = session.exec(
        select(TripBoatPricing).where(TripBoatPricing.trip_boat_id == trip_boat.id)
    ).all()

    if getattr(trip_boat, "use_only_trip_pricing", False):
        by_type_trip_price = {tbp.ticket_type: tbp.price for tbp in trip_boat_pricing}
        all_types = set(by_type_trip_price)
        by_type_boat_price = {}
    else:
        boat_pricing = session.exec(
            select(BoatPricing).where(BoatPricing.boat_id == boat_id)
        ).all()
        by_type_boat_price = {bp.ticket_type: bp.price for bp in boat_pricing}
        by_type_trip_price = {tbp.ticket_type: tbp.price for tbp in trip_boat_pricing}
        all_types = set(by_type_boat_price) | set(by_type_trip_price)

    capacities = get_effective_capacity_per_ticket_type(
        session=session, trip_id=trip_id, boat_id=boat_id
    )
    result: list[EffectivePricingItem] = []
    paid_map = paid_by_type or {}
    for ticket_type in sorted(all_types):
        price = by_type_trip_price.get(ticket_type) or by_type_boat_price.get(
            ticket_type
        )
        if price is None:
            continue
        capacity = capacities.get(ticket_type, 0)
        paid = sum(
            v
            for (bid, k), v in paid_map.items()
            if bid == boat_id and (k or "").lower() == (ticket_type or "").lower()
        )
        remaining = max(0, capacity - paid)
        result.append(
            EffectivePricingItem(
                ticket_type=ticket_type,
                price=price,
                capacity=capacity,
                remaining=remaining,
            )
        )
    return result


def get_effective_ticket_types_for_trip(
    *, session: Session, trip_id: uuid.UUID
) -> list[str]:
    """
    Return sorted union of all ticket types across boats on this trip.
    When use_only_trip_pricing: only types from TripBoatPricing for that boat.
    """
    from app.models import TripBoat

    trip_boats = session.exec(select(TripBoat).where(TripBoat.trip_id == trip_id)).all()
    all_types: set[str] = set()
    for tb in trip_boats:
        if getattr(tb, "use_only_trip_pricing", False):
            trip_boat_pricing = session.exec(
                select(TripBoatPricing).where(TripBoatPricing.trip_boat_id == tb.id)
            ).all()
            for tbp in trip_boat_pricing:
                all_types.add(tbp.ticket_type)
        else:
            boat_pricing = session.exec(
                select(BoatPricing).where(BoatPricing.boat_id == tb.boat_id)
            ).all()
            trip_boat_pricing = session.exec(
                select(TripBoatPricing).where(TripBoatPricing.trip_boat_id == tb.id)
            ).all()
            for bp in boat_pricing:
                all_types.add(bp.ticket_type)
            for tbp in trip_boat_pricing:
                all_types.add(tbp.ticket_type)
    return sorted(all_types)
