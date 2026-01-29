from fastapi import APIRouter

from app.api.routes import (
    boats,
    booking_payments,
    booking_public,
    bookings,
    discount_codes,
    jurisdictions,
    launches,
    locations,
    login,
    merchandise,
    missions,
    payments,
    private,
    providers,
    trip_boats,
    trip_merchandise,
    trip_pricing,
    trips,
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
api_router.include_router(trips.router)
api_router.include_router(trip_boats.router)
api_router.include_router(trip_pricing.router)
api_router.include_router(trip_merchandise.router)
api_router.include_router(discount_codes.router)
api_router.include_router(bookings.router)
api_router.include_router(booking_public.router)
api_router.include_router(booking_payments.router)
api_router.include_router(payments.router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
