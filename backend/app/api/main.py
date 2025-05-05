from fastapi import APIRouter

from app.api.routes import (
    items,
    jurisdictions,
    launches,
    locations,
    login,
    missions,
    private,
    users,
    utils,
)
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(items.router)
api_router.include_router(locations.router)
api_router.include_router(jurisdictions.router)
api_router.include_router(launches.router)
api_router.include_router(missions.router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
