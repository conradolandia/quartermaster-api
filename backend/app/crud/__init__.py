"""
CRUD operations for the Quartermaster application.

This module provides database operations organized by domain.
"""

# Import all CRUD functions to maintain backward compatibility
from .boats import (
    create_boat,
    delete_boat,
    get_boat,
    get_boats,
    get_boats_by_jurisdiction,
    get_boats_count,
    get_boats_no_relationships,
    update_boat,
)
from .booking_items import (
    create_booking_item,
    delete_booking_item,
    get_booking_item,
    get_booking_items_by_trip,
    update_booking_item,
)
from .jurisdictions import (
    create_jurisdiction,
    delete_jurisdiction,
    get_jurisdiction,
    get_jurisdictions,
    get_jurisdictions_by_location,
    get_jurisdictions_count,
    update_jurisdiction,
)
from .launches import (
    create_launch,
    delete_launch,
    get_launch,
    get_launches,
    get_launches_by_location,
    get_launches_count,
    get_launches_no_relationships,
    update_launch,
)
from .locations import (
    create_location,
    delete_location,
    get_location,
    get_locations,
    get_locations_count,
    get_locations_no_relationships,
    update_location,
)
from .missions import (
    create_mission,
    delete_mission,
    get_active_missions,
    get_mission,
    get_missions,
    get_missions_by_launch,
    get_missions_count,
    get_missions_no_relationships,
    get_missions_with_stats,
    get_public_missions,
    update_mission,
)
from .providers import (
    create_provider,
    delete_provider,
    get_provider,
    get_providers,
    get_providers_by_jurisdiction,
    get_providers_count,
    update_provider,
)
from .trip_boats import (
    create_trip_boat,
    delete_trip_boat,
    get_trip_boat,
    get_trip_boats_by_boat,
    get_trip_boats_by_trip,
    update_trip_boat,
)
from .trip_merchandise import (
    create_trip_merchandise,
    delete_trip_merchandise,
    get_trip_merchandise,
    get_trip_merchandise_by_trip,
    update_trip_merchandise,
)
from .trip_pricing import (
    create_trip_pricing,
    delete_trip_pricing,
    get_trip_pricing,
    get_trip_pricing_by_trip,
    update_trip_pricing,
)
from .trips import (
    create_trip,
    delete_trip,
    get_trip,
    get_trips,
    get_trips_by_mission,
    get_trips_count,
    get_trips_no_relationships,
    update_trip,
)
from .users import (
    authenticate,
    create_user,
    get_user_by_email,
    update_user,
)

__all__ = [
    # Users
    "authenticate",
    "create_user",
    "get_user_by_email",
    "update_user",
    # Locations
    "create_location",
    "delete_location",
    "get_location",
    "get_locations",
    "get_locations_count",
    "get_locations_no_relationships",
    "update_location",
    # Jurisdictions
    "create_jurisdiction",
    "delete_jurisdiction",
    "get_jurisdiction",
    "get_jurisdictions",
    "get_jurisdictions_by_location",
    "get_jurisdictions_count",
    "update_jurisdiction",
    # Providers
    "create_provider",
    "delete_provider",
    "get_provider",
    "get_providers",
    "get_providers_by_jurisdiction",
    "get_providers_count",
    "update_provider",
    # Launches
    "create_launch",
    "delete_launch",
    "get_launch",
    "get_launches",
    "get_launches_by_location",
    "get_launches_count",
    "get_launches_no_relationships",
    "update_launch",
    # Missions
    "create_mission",
    "delete_mission",
    "get_active_missions",
    "get_mission",
    "get_missions",
    "get_missions_by_launch",
    "get_missions_count",
    "get_missions_no_relationships",
    "get_missions_with_stats",
    "get_public_missions",
    "update_mission",
    # Boats
    "create_boat",
    "delete_boat",
    "get_boat",
    "get_boats",
    "get_boats_by_jurisdiction",
    "get_boats_count",
    "get_boats_no_relationships",
    "update_boat",
    # Trips
    "create_trip",
    "delete_trip",
    "get_trip",
    "get_trips",
    "get_trips_by_mission",
    "get_trips_count",
    "get_trips_no_relationships",
    "update_trip",
    # Trip Boats
    "create_trip_boat",
    "delete_trip_boat",
    "get_trip_boat",
    "get_trip_boats_by_boat",
    "get_trip_boats_by_trip",
    "update_trip_boat",
    # Trip Merchandise
    "create_trip_merchandise",
    "delete_trip_merchandise",
    "get_trip_merchandise",
    "get_trip_merchandise_by_trip",
    "update_trip_merchandise",
    # Trip Pricing
    "create_trip_pricing",
    "delete_trip_pricing",
    "get_trip_pricing",
    "get_trip_pricing_by_trip",
    "update_trip_pricing",
    # Booking Items
    "create_booking_item",
    "delete_booking_item",
    "get_booking_item",
    "get_booking_items_by_trip",
    "update_booking_item",
]
