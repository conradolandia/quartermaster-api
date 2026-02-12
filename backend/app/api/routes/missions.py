import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlmodel import Session

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    Mission,
    MissionCreate,
    MissionPublic,
    MissionsPublic,
    MissionsWithStatsPublic,
    MissionUpdate,
)
from app.services.yaml_importer import YamlImporter
from app.services.yaml_validator import YamlValidationError

router = APIRouter(prefix="/missions", tags=["missions"])


def _mission_to_public(session: Session, mission: Mission) -> MissionPublic:
    """Build MissionPublic with timezone from mission's launch->location."""
    launch = crud.get_launch(session=session, launch_id=mission.launch_id)
    tz = "UTC"
    if launch:
        location = crud.get_location(session=session, location_id=launch.location_id)
        if location:
            tz = location.timezone
    data = mission.model_dump(mode="json", exclude={"launch"})
    return MissionPublic(**data, timezone=tz)


@router.get(
    "/",
    response_model=MissionsWithStatsPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_missions(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve missions with booking statistics.
    """
    missions = crud.get_missions_with_stats(session=session, skip=skip, limit=limit)
    count = crud.get_missions_count(session=session)
    return MissionsWithStatsPublic(data=missions, count=count)


@router.post(
    "/",
    response_model=MissionPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_mission(
    *,
    session: Session = Depends(deps.get_db),
    mission_in: MissionCreate,
) -> Any:
    """
    Create new mission.
    """
    # Verify that the launch exists
    launch = crud.get_launch(session=session, launch_id=mission_in.launch_id)
    if not launch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Launch with ID {mission_in.launch_id} not found",
        )

    mission = crud.create_mission(session=session, mission_in=mission_in)
    return _mission_to_public(session, mission)


@router.post(
    "/{mission_id}/duplicate",
    response_model=MissionPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def duplicate_mission(
    *,
    session: Session = Depends(deps.get_db),
    mission_id: uuid.UUID,
) -> Any:
    """
    Duplicate mission: create a new mission with the same launch, name (copy),
    active, and refund_cutoff_hours.
    """
    mission = crud.get_mission(session=session, mission_id=mission_id)
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission with ID {mission_id} not found",
        )
    copy_name = (mission.name or "Mission").strip()
    copy_name = f"{copy_name} (copy)" if copy_name else "Mission (copy)"
    mission_in = MissionCreate(
        name=copy_name,
        launch_id=mission.launch_id,
        active=mission.active,
        refund_cutoff_hours=mission.refund_cutoff_hours,
    )
    new_mission = crud.create_mission(session=session, mission_in=mission_in)
    return _mission_to_public(session, new_mission)


@router.get(
    "/{mission_id}",
    response_model=MissionPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_mission(
    *,
    session: Session = Depends(deps.get_db),
    mission_id: uuid.UUID,
) -> Any:
    """
    Get mission by ID.
    """
    mission = crud.get_mission(session=session, mission_id=mission_id)
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission with ID {mission_id} not found",
        )
    return _mission_to_public(session, mission)


@router.put(
    "/{mission_id}",
    response_model=MissionPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_mission(
    *,
    session: Session = Depends(deps.get_db),
    mission_id: uuid.UUID,
    mission_in: MissionUpdate,
) -> Any:
    """
    Update a mission.
    """
    mission = crud.get_mission(session=session, mission_id=mission_id)
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission with ID {mission_id} not found",
        )

    # Get the launch (either existing or new if being updated)
    launch_id = (
        mission_in.launch_id if mission_in.launch_id is not None else mission.launch_id
    )
    launch = crud.get_launch(session=session, launch_id=launch_id)
    if not launch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Launch with ID {launch_id} not found",
        )

    # If launch_id is being updated, verify that the new launch exists
    if mission_in.launch_id is not None:
        new_launch = crud.get_launch(session=session, launch_id=mission_in.launch_id)
        if not new_launch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Launch with ID {mission_in.launch_id} not found",
            )
        launch = new_launch

    mission = crud.update_mission(session=session, db_obj=mission, obj_in=mission_in)
    return _mission_to_public(session, mission)


@router.delete(
    "/{mission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_mission(
    *,
    session: Session = Depends(deps.get_db),
    mission_id: uuid.UUID,
) -> None:
    """
    Delete a mission.
    """
    mission = crud.get_mission(session=session, mission_id=mission_id)
    if not mission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mission with ID {mission_id} not found",
        )

    crud.delete_mission(session=session, db_obj=mission)


@router.get(
    "/launch/{launch_id}",
    response_model=MissionsPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_missions_by_launch(
    *,
    session: Session = Depends(deps.get_db),
    launch_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve missions for a specific launch.
    """
    # Verify that the launch exists
    launch = crud.get_launch(session=session, launch_id=launch_id)
    if not launch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Launch with ID {launch_id} not found",
        )
    location = crud.get_location(session=session, location_id=launch.location_id)
    tz = location.timezone if location else "UTC"

    missions = crud.get_missions_by_launch(
        session=session, launch_id=launch_id, skip=skip, limit=limit
    )
    count = len(missions)

    mission_dicts = [
        {
            "id": mission.id,
            "name": mission.name,
            "launch_id": mission.launch_id,
            "active": mission.active,
            "refund_cutoff_hours": mission.refund_cutoff_hours,
            "created_at": mission.created_at,
            "updated_at": mission.updated_at,
            "timezone": tz,
        }
        for mission in missions
    ]

    return MissionsPublic(data=mission_dicts, count=count)


@router.get(
    "/active/",
    response_model=MissionsPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_active_missions(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve active missions.
    """
    missions = crud.get_active_missions(session=session, skip=skip, limit=limit)
    count = len(missions)

    mission_dicts = []
    for mission in missions:
        launch = crud.get_launch(session=session, launch_id=mission.launch_id)
        location = (
            crud.get_location(session=session, location_id=launch.location_id)
            if launch
            else None
        )
        tz = location.timezone if location else "UTC"
        mission_dicts.append(
            {
                "id": mission.id,
                "name": mission.name,
                "launch_id": mission.launch_id,
                "active": mission.active,
                "refund_cutoff_hours": mission.refund_cutoff_hours,
                "created_at": mission.created_at,
                "updated_at": mission.updated_at,
                "timezone": tz,
            }
        )

    return MissionsPublic(data=mission_dicts, count=count)


@router.get("/public/", response_model=MissionsPublic)
def read_public_missions(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve public missions.
    """
    missions = crud.get_public_missions(session=session, skip=skip, limit=limit)
    count = len(missions)

    mission_dicts = []
    for mission in missions:
        launch = crud.get_launch(session=session, launch_id=mission.launch_id)
        location = (
            crud.get_location(session=session, location_id=launch.location_id)
            if launch
            else None
        )
        tz = location.timezone if location else "UTC"
        mission_dicts.append(
            {
                "id": mission.id,
                "name": mission.name,
                "launch_id": mission.launch_id,
                "active": mission.active,
                "refund_cutoff_hours": mission.refund_cutoff_hours,
                "created_at": mission.created_at,
                "updated_at": mission.updated_at,
                "timezone": tz,
            }
        )

    return MissionsPublic(data=mission_dicts, count=count)


@router.post(
    "/import-yaml",
    response_model=MissionPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def import_mission_from_yaml(
    *,
    session: Session = Depends(deps.get_db),
    file: UploadFile = File(...),
) -> Any:
    """
    Import a mission from YAML file.

    Expected YAML format:
    ```yaml
    name: "Mars Sample Return"
    description: "Return samples from Mars to Earth"
    launch_id: "spacex-falcon-heavy-2024-03-15"
    duration_days: 1095
    status: "planned"
    ```
    """
    try:
        # Validate file type
        if not file.filename.endswith((".yaml", ".yml")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be a YAML file (.yaml or .yml)",
            )

        # Read file content
        yaml_content = file.file.read().decode("utf-8")

        # Import using YamlImporter
        importer = YamlImporter(session)
        mission = importer.import_mission(yaml_content)

        return _mission_to_public(session, mission)

    except YamlValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"YAML validation error: {e.message}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import mission: {str(e)}",
        )
