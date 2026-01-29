import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    Booking,
    BookingItem,
    BookingStatus,
    Launch,
    LaunchCreate,
    LaunchesPublic,
    LaunchPublic,
    LaunchUpdate,
    Mission,
    Trip,
)
from app.services.date_validator import is_launch_past
from app.services.yaml_importer import YamlImporter
from app.services.yaml_validator import YamlValidationError
from app.utils import generate_launch_update_email, send_email

logger = logging.getLogger(__name__)

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

    # Validate launch timestamp is not in the past
    # Create a temporary launch object to check if it's past
    temp_launch = Launch.model_validate(launch_in)
    if is_launch_past(temp_launch):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create launch: Launch timestamp cannot be in the past",
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
    allow_past_edit: bool = False,
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

    # Check if launch is in the past and prevent editing unless override is allowed
    if is_launch_past(launch) and not allow_past_edit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update launch: This launch has already occurred. Use allow_past_edit=true to override",
        )

    # If launch_timestamp is being updated, validate it's not in the past (unless override)
    if launch_in.launch_timestamp is not None:
        temp_launch = Launch.model_validate(
            {**launch.model_dump(), "launch_timestamp": launch_in.launch_timestamp}
        )
        if is_launch_past(temp_launch) and not allow_past_edit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update launch: Launch timestamp cannot be in the past. Use allow_past_edit=true to override",
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

    # Log override action if past edit was allowed
    if allow_past_edit and is_launch_past(launch):
        logger.warning(
            f"Superuser override: Launch {launch_id} was edited despite being in the past"
        )

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


class LaunchUpdateMessage(BaseModel):
    """Request body for sending launch update emails."""

    message: str
    priority: bool = False


class LaunchUpdateResponse(BaseModel):
    """Response for launch update email sending."""

    emails_sent: int
    emails_failed: int
    recipients: list[str]


@router.post(
    "/{launch_id}/send-update",
    response_model=LaunchUpdateResponse,
    dependencies=[Depends(get_current_active_superuser)],
)
def send_launch_update(
    *,
    session: Session = Depends(deps.get_db),
    launch_id: uuid.UUID,
    update_data: LaunchUpdateMessage,
) -> Any:
    """
    Send a launch update email to all customers with confirmed bookings
    for this launch who have opted in to receive launch updates.

    If priority is True, sends to all customers regardless of their
    launch_updates_pref setting.
    """
    # Get the launch
    launch = crud.get_launch(session=session, launch_id=launch_id)
    if not launch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Launch with ID {launch_id} not found",
        )

    # Find all bookings for this launch
    # Path: Launch -> Mission -> Trip -> BookingItem -> Booking
    # If priority is False, only include bookings where launch_updates_pref is True
    statement = (
        select(Booking)
        .join(BookingItem, BookingItem.booking_id == Booking.id)
        .join(Trip, Trip.id == BookingItem.trip_id)
        .join(Mission, Mission.id == Trip.mission_id)
        .where(Mission.launch_id == launch_id)
        .where(Booking.status.in_([BookingStatus.confirmed, BookingStatus.checked_in]))
        .distinct()
    )

    # Only filter by launch_updates_pref if priority is False
    if not update_data.priority:
        statement = statement.where(Booking.launch_updates_pref == True)  # noqa: E712
    bookings = session.exec(statement).all()

    emails_sent = 0
    emails_failed = 0
    recipients = []

    for booking in bookings:
        try:
            # Generate and send the email
            email_data = generate_launch_update_email(
                email_to=booking.user_email,
                user_name=booking.user_name,
                confirmation_code=booking.confirmation_code,
                mission_name=launch.name,
                update_message=update_data.message,
            )
            send_email(
                email_to=booking.user_email,
                subject=email_data.subject,
                html_content=email_data.html_content,
            )
            emails_sent += 1
            recipients.append(booking.user_email)
            logger.info(f"Sent launch update to {booking.user_email}")
        except Exception as e:
            emails_failed += 1
            logger.error(
                f"Failed to send launch update to {booking.user_email}: {str(e)}"
            )

    return LaunchUpdateResponse(
        emails_sent=emails_sent,
        emails_failed=emails_failed,
        recipients=recipients,
    )
