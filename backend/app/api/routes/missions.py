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
from app.services.date_validator import (
    is_mission_past,
    validate_mission_dates,
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

    # Validate mission dates are coherent with launch
    # Create a temporary mission object to validate
    temp_mission = Mission.model_validate(mission_in)
    is_valid, error_msg = validate_mission_dates(temp_mission, launch)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot create mission: {error_msg}",
        )

    mission = crud.create_mission(session=session, mission_in=mission_in)
    return _mission_to_public(session, mission)


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
    allow_past_edit: bool = False,
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

    # Check if mission's launch is in the past and prevent editing unless override is allowed
    if is_mission_past(mission, session) and not allow_past_edit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update mission: This mission's launch has already occurred. Use allow_past_edit=true to override",
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

    # Validate mission dates are coherent with launch
    # Merge update data with existing mission data for validation
    update_data = mission_in.model_dump(exclude_unset=True)
    temp_mission_data = {**mission.model_dump(), **update_data}
    temp_mission = Mission.model_validate(temp_mission_data)
    is_valid, error_msg = validate_mission_dates(temp_mission, launch)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update mission: {error_msg}",
        )

    mission = crud.update_mission(session=session, db_obj=mission, obj_in=mission_in)

    # Log override action if past edit was allowed
    if allow_past_edit and is_mission_past(mission, session):
        import logging

        logger = logging.getLogger(__name__)
        logger.warning(
            f"Superuser override: Mission {mission_id} was edited despite launch being in the past"
        )

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
            "booking_mode": mission.booking_mode,
            "sales_open_at": mission.sales_open_at,
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
                "booking_mode": mission.booking_mode,
                "sales_open_at": mission.sales_open_at,
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
                "booking_mode": mission.booking_mode,
                "sales_open_at": mission.sales_open_at,
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
