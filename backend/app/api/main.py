from fastapi import APIRouter

from app.api.routes import (
    boat_pricing,
    boats,
    booking_admin,
    booking_admin_items,
    booking_admin_operations,
    booking_export,
    booking_payments,
    booking_public,
    booking_refund,
    discount_codes,
    imports,
    jurisdictions,
    launches,
    locations,
    login,
    merchandise,
    missions,
    payments,
    private,
    providers,
    trip_boat_pricing,
    trip_boats,
    trip_merchandise,
    trips_admin,
    trips_operations,
    trips_public,
    users,
    utils,
)
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(locations.router)
api_router.include_router(merchandise.router)
api_router.include_router(jurisdictions.router)
api_router.include_router(providers.router)
api_router.include_router(launches.router)
api_router.include_router(missions.router)
api_router.include_router(boats.router)
api_router.include_router(boat_pricing.router)
# Trip routes: public first (more specific paths), then operations, then admin
api_router.include_router(trips_public.router)
api_router.include_router(trips_operations.router)
api_router.include_router(trips_admin.router)
api_router.include_router(imports.router)
api_router.include_router(trip_boats.router)
api_router.include_router(trip_boat_pricing.router)
api_router.include_router(trip_merchandise.router)
api_router.include_router(discount_codes.router)
api_router.include_router(booking_admin.router)
api_router.include_router(booking_admin_items.router)
api_router.include_router(booking_admin_operations.router)
api_router.include_router(booking_public.router)
api_router.include_router(booking_payments.router)
api_router.include_router(booking_export.router)
api_router.include_router(booking_refund.router)
api_router.include_router(payments.router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
