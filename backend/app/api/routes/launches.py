import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlmodel import Session

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    LaunchCreate,
    LaunchesPublic,
    LaunchPublic,
    LaunchUpdate,
)
from app.services.yaml_importer import YamlImporter
from app.services.yaml_validator import YamlValidationError

router = APIRouter(prefix="/launches", tags=["launches"])


@router.get(
    "/",
    response_model=LaunchesPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_launches(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve launches.
    """
    launches = crud.get_launches_no_relationships(
        session=session, skip=skip, limit=limit
    )
    count = crud.get_launches_count(session=session)
    return LaunchesPublic(data=launches, count=count)


@router.post(
    "/",
    response_model=LaunchPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_launch(
    *,
    session: Session = Depends(deps.get_db),
    launch_in: LaunchCreate,
) -> Any:
    """
    Create new launch.
    """
    # Verify that the location exists
    location = crud.get_location(session=session, location_id=launch_in.location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Location with ID {launch_in.location_id} not found",
        )

    launch = crud.create_launch(session=session, launch_in=launch_in)
    return launch


@router.get(
    "/{launch_id}",
    response_model=LaunchPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_launch(
    *,
    session: Session = Depends(deps.get_db),
    launch_id: uuid.UUID,
) -> Any:
    """
    Get launch by ID.
    """
    launch = crud.get_launch(session=session, launch_id=launch_id)
    if not launch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Launch with ID {launch_id} not found",
        )
    return launch


@router.put(
    "/{launch_id}",
    response_model=LaunchPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_launch(
    *,
    session: Session = Depends(deps.get_db),
    launch_id: uuid.UUID,
    launch_in: LaunchUpdate,
) -> Any:
    """
    Update a launch.
    """
    launch = crud.get_launch(session=session, launch_id=launch_id)
    if not launch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Launch with ID {launch_id} not found",
        )

    # If location_id is being updated, verify that the new location exists
    if launch_in.location_id is not None:
        location = crud.get_location(session=session, location_id=launch_in.location_id)
        if not location:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Location with ID {launch_in.location_id} not found",
            )

    launch = crud.update_launch(session=session, db_obj=launch, obj_in=launch_in)
    return launch


@router.delete(
    "/{launch_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_launch(
    *,
    session: Session = Depends(deps.get_db),
    launch_id: uuid.UUID,
) -> None:
    """
    Delete a launch.
    """
    launch = crud.get_launch(session=session, launch_id=launch_id)
    if not launch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Launch with ID {launch_id} not found",
        )

    crud.delete_launch(session=session, db_obj=launch)


@router.get(
    "/location/{location_id}",
    response_model=LaunchesPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def read_launches_by_location(
    *,
    session: Session = Depends(deps.get_db),
    location_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve launches for a specific location.
    """
    # Verify that the location exists
    location = crud.get_location(session=session, location_id=location_id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Location with ID {location_id} not found",
        )

    launches = crud.get_launches_by_location(
        session=session, location_id=location_id, skip=skip, limit=limit
    )
    count = len(launches)

    # Convert to dictionaries to break the ORM relationship chain
    launch_dicts = [
        {
            "id": launch.id,
            "name": launch.name,
            "launch_timestamp": launch.launch_timestamp,
            "summary": launch.summary,
            "location_id": launch.location_id,
            "created_at": launch.created_at,
            "updated_at": launch.updated_at,
        }
        for launch in launches
    ]

    return LaunchesPublic(data=launch_dicts, count=count)


@router.get("/public/", response_model=LaunchesPublic)
def read_public_launches(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve public launches for booking form.
    """
    launches = crud.get_launches_no_relationships(
        session=session, skip=skip, limit=limit
    )
    count = crud.get_launches_count(session=session)
    return LaunchesPublic(data=launches, count=count)


@router.get("/public/{launch_id}", response_model=LaunchPublic)
def read_public_launch(
    *,
    session: Session = Depends(deps.get_db),
    launch_id: uuid.UUID,
) -> Any:
    """
    Get public launch by ID for booking form.
    """
    launch = crud.get_launch(session=session, launch_id=launch_id)
    if not launch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Launch with ID {launch_id} not found",
        )
    return launch


@router.post(
    "/import-yaml",
    response_model=LaunchPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def import_launch_from_yaml(
    *,
    session: Session = Depends(deps.get_db),
    file: UploadFile = File(...),
) -> Any:
    """
    Import a launch from YAML file.

    Expected YAML format:
    ```yaml
    name: "SpaceX Falcon Heavy - Mars Mission"
    provider: "SpaceX"
    launch_date: "2024-03-15T14:30:00Z"
    launch_site: "Kennedy Space Center LC-39A"
    description: "Launch of Mars Sample Return mission"
    status: "scheduled"
    live_stream_url: "https://youtube.com/watch?v=..."
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
        launch = importer.import_launch(yaml_content)

        return launch

    except YamlValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"YAML validation error: {e.message}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import launch: {str(e)}",
        )
