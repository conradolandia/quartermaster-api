#!/usr/bin/env python3
"""
Compare paid ticket counts (capacity accounting) to trip capacity endpoint totals.

Run inside the backend container from the backend app root, e.g.:
  docker compose exec backend bash -c "cd /app && python scripts/verify_trip_capacity_metrics.py --trip-id <UUID>"

Requires database access (same as the API). Optional: --boat-id to print per-boat breakdown.
"""

from __future__ import annotations

import argparse
import sys
import uuid

from sqlmodel import Session

from app import crud
from app.core.db import engine


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Print paid seat counts vs GET /trips/{id}/capacity semantics."
    )
    parser.add_argument(
        "--trip-id",
        required=True,
        type=uuid.UUID,
        help="Trip UUID",
    )
    parser.add_argument(
        "--boat-id",
        type=uuid.UUID,
        default=None,
        help="Optional boat UUID for per-type paid counts",
    )
    args = parser.parse_args()

    with Session(engine) as session:
        trip = crud.get_trip(session=session, trip_id=args.trip_id)
        if not trip:
            print("Trip not found", file=sys.stderr)
            return 1

        paid_by_boat = crud.get_paid_ticket_count_per_boat_for_trip(
            session=session, trip_id=args.trip_id
        )
        total_used = sum(paid_by_boat.values())

        trip_boats = crud.get_trip_boats_by_trip(
            session=session, trip_id=args.trip_id, skip=0, limit=500
        )
        total_cap = 0
        for tb in trip_boats:
            boat = crud.get_boat(session=session, boat_id=tb.boat_id)
            eff = (
                tb.max_capacity
                if tb.max_capacity is not None
                else (boat.capacity if boat else 0)
            )
            total_cap += eff

        print(f"trip_id={args.trip_id}")
        print(f"total_capacity (sum of effective max per trip-boat)={total_cap}")
        print(f"used_capacity (sum of paid tickets per boat)={total_used}")
        print("per_boat_paid:", dict(paid_by_boat))

        if args.boat_id:
            paid_by_type = crud.get_paid_ticket_count_per_boat_per_item_type_for_trip(
                session=session, trip_id=args.trip_id
            )
            for boat_id in paid_by_boat:
                if boat_id != args.boat_id:
                    continue
                types_for_boat = {
                    k[1]: v for k, v in paid_by_type.items() if k[0] == args.boat_id
                }
                print(f"boat {args.boat_id} paid by item_type:", types_for_boat)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
