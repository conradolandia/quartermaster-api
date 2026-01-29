from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlmodel import Session

from app.api import deps
from app.api.deps import get_current_active_superuser
from app.api.routes.launches import _launch_to_public
from app.api.routes.missions import _mission_to_public
from app.api.routes.trips import _trip_to_public
from app.models import LaunchPublic, MissionPublic, TripPublic
from app.services.yaml_importer import YamlImporter
from app.services.yaml_validator import YamlValidationError

router = APIRouter(prefix="/import", tags=["import"])


class ImportResult(BaseModel):
    """Result of a multi-entity YAML import."""

    launches: list[LaunchPublic] = []
    missions: list[MissionPublic] = []
    trips: list[TripPublic] = []


@router.post(
    "/yaml",
    response_model=ImportResult,
    dependencies=[Depends(get_current_active_superuser)],
)
def import_yaml_document(
    *,
    session: Session = Depends(deps.get_db),
    file: UploadFile = File(...),
) -> Any:
    """
    Import launches, missions, and trips from a single YAML file.

    Root must contain at least one of: launches (list), missions (list), trips (list).
    Missions may use launch_id (UUID) or launch_ref (0-based index into launches in this file).
    Trips may use mission_id (UUID) or mission_ref (0-based index into missions in this file).
    Creation order: launches, then missions, then trips.
    """
    try:
        if not file.filename or not file.filename.endswith((".yaml", ".yml")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be a YAML file (.yaml or .yml)",
            )

        yaml_content = file.file.read().decode("utf-8")
        importer = YamlImporter(session)
        created_launches, created_missions, created_trips = importer.import_document(
            yaml_content
        )

        return ImportResult(
            launches=[
                _launch_to_public(session, launch) for launch in created_launches
            ],
            missions=[
                _mission_to_public(session, mission) for mission in created_missions
            ],
            trips=[_trip_to_public(session, trip) for trip in created_trips],
        )

    except YamlValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"YAML validation error: {e.message}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import: {str(e)}",
        )
