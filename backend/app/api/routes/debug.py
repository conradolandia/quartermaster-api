import logging

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/debug", tags=["debug"])
logger = logging.getLogger(__name__)


class DomStateLog(BaseModel):
    """Client-side DOM state for sidebar unclickable bug monitoring."""

    message: str = ""
    data: dict = {}
    timestamp: int = 0


@router.post("/dom-state", status_code=204)
def log_dom_state(payload: DomStateLog) -> None:
    """
    Receive and log client DOM state for debugging sidebar unclickable issue.
    Called periodically from the frontend when VITE_DEBUG_LOG_ENABLED is set.
    """
    logger.info("dom_state: %s", payload.model_dump_json())
