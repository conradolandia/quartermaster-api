import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app import crud
from app.api import deps
from app.models import (
    MissionCreate,
    MissionPublic,
    MissionsPublic,
    MissionsWithStatsPublic,
    MissionUpdate,
)

router = APIRouter(prefix="/missions", tags=["missions"])


@router.get("/", response_model=MissionsWithStatsPublic)
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


@router.post("/", response_model=MissionPublic, status_code=status.HTTP_201_CREATED)
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
    return mission


@router.get("/{mission_id}", response_model=MissionPublic)
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
    return mission


@router.put("/{mission_id}", response_model=MissionPublic)
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

    # If launch_id is being updated, verify that the new launch exists
    if mission_in.launch_id is not None:
        launch = crud.get_launch(session=session, launch_id=mission_in.launch_id)
        if not launch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Launch with ID {mission_in.launch_id} not found",
            )

    mission = crud.update_mission(session=session, db_obj=mission, obj_in=mission_in)
    return mission


@router.delete("/{mission_id}", status_code=status.HTTP_204_NO_CONTENT)
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


@router.get("/launch/{launch_id}", response_model=MissionsPublic)
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

    missions = crud.get_missions_by_launch(
        session=session, launch_id=launch_id, skip=skip, limit=limit
    )
    count = len(missions)

    # Convert to dictionaries to break the ORM relationship chain
    mission_dicts = [
        {
            "id": mission.id,
            "name": mission.name,
            "launch_id": mission.launch_id,
            "active": mission.active,
            "public": mission.public,
            "sales_open_at": mission.sales_open_at,
            "refund_cutoff_hours": mission.refund_cutoff_hours,
            "created_at": mission.created_at,
            "updated_at": mission.updated_at,
        }
        for mission in missions
    ]

    return MissionsPublic(data=mission_dicts, count=count)


@router.get("/active/", response_model=MissionsPublic)
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

    # Convert to dictionaries to break the ORM relationship chain
    mission_dicts = [
        {
            "id": mission.id,
            "name": mission.name,
            "launch_id": mission.launch_id,
            "active": mission.active,
            "public": mission.public,
            "sales_open_at": mission.sales_open_at,
            "refund_cutoff_hours": mission.refund_cutoff_hours,
            "created_at": mission.created_at,
            "updated_at": mission.updated_at,
        }
        for mission in missions
    ]

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

    # Convert to dictionaries to break the ORM relationship chain
    mission_dicts = [
        {
            "id": mission.id,
            "name": mission.name,
            "launch_id": mission.launch_id,
            "active": mission.active,
            "public": mission.public,
            "sales_open_at": mission.sales_open_at,
            "refund_cutoff_hours": mission.refund_cutoff_hours,
            "created_at": mission.created_at,
            "updated_at": mission.updated_at,
        }
        for mission in missions
    ]

    return MissionsPublic(data=mission_dicts, count=count)
