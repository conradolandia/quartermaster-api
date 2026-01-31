"""
Effective pricing: BoatPricing defaults merged with TripBoatPricing overrides per (trip_id, boat_id).
"""

import uuid

from sqlmodel import Session, select

from app.models import (
    BoatPricing,
    EffectivePricingItem,
    TripBoat,
    TripBoatPricing,
)


def get_effective_pricing(
    *,
    session: Session,
    trip_id: uuid.UUID,
    boat_id: uuid.UUID,
) -> list[EffectivePricingItem]:
    """
    Return effective ticket types and prices for a (trip_id, boat_id).
    Boat defaults (BoatPricing) merged with per-trip overrides (TripBoatPricing).
    """
    trip_boat = session.exec(
        select(TripBoat).where(
            TripBoat.trip_id == trip_id,
            TripBoat.boat_id == boat_id,
        )
    ).first()
    if not trip_boat:
        return []

    boat_pricing = session.exec(
        select(BoatPricing).where(BoatPricing.boat_id == boat_id)
    ).all()
    trip_boat_pricing = session.exec(
        select(TripBoatPricing).where(TripBoatPricing.trip_boat_id == trip_boat.id)
    ).all()

    by_type_boat: dict[str, int] = {bp.ticket_type: bp.price for bp in boat_pricing}
    by_type_trip: dict[str, int] = {
        tbp.ticket_type: tbp.price for tbp in trip_boat_pricing
    }
    all_types = set(by_type_boat) | set(by_type_trip)
    result: list[EffectivePricingItem] = []
    for ticket_type in sorted(all_types):
        price = by_type_trip.get(ticket_type) or by_type_boat.get(ticket_type)
        if price is not None:
            result.append(EffectivePricingItem(ticket_type=ticket_type, price=price))
    return result


def get_effective_ticket_types_for_trip(
    *, session: Session, trip_id: uuid.UUID
) -> list[str]:
    """
    Return sorted union of all ticket types across boats on this trip.
    Used for CSV export when trip_id is provided.
    """
    from app.models import TripBoat

    trip_boats = session.exec(select(TripBoat).where(TripBoat.trip_id == trip_id)).all()
    all_types: set[str] = set()
    for tb in trip_boats:
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
