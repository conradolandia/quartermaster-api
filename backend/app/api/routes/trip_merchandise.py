import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    TripMerchandise,
    TripMerchandiseCreate,
    TripMerchandisePublic,
    TripMerchandiseUpdate,
)

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trip-merchandise", tags=["trip-merchandise"])


@router.post(
    "/",
    response_model=TripMerchandisePublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_trip_merchandise(
    *,
    session: Session = Depends(deps.get_db),
    trip_merchandise_in: TripMerchandiseCreate,
) -> TripMerchandisePublic:
    """
    Create new trip merchandise.
    """
    try:
        trip_merchandise = TripMerchandise.model_validate(trip_merchandise_in)
        session.add(trip_merchandise)
        session.commit()
        session.refresh(trip_merchandise)

        logger.info(f"Created trip merchandise: {trip_merchandise.id}")
        return TripMerchandisePublic.model_validate(trip_merchandise)

    except Exception as e:
        logger.exception(f"Error creating trip merchandise: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating trip merchandise.",
        )


@router.get(
    "/",
    response_model=list[TripMerchandisePublic],
    dependencies=[Depends(get_current_active_superuser)],
)
def list_trip_merchandise(
    *,
    session: Session = Depends(deps.get_db),
    trip_id: uuid.UUID | None = None,
) -> list[TripMerchandisePublic]:
    """
    List trip merchandise with optional filtering.
    """
    try:
        query = select(TripMerchandise)

        if trip_id:
            query = query.where(TripMerchandise.trip_id == trip_id)

        trip_merchandise_list = session.exec(query).all()
        return [
            TripMerchandisePublic.model_validate(merchandise)
            for merchandise in trip_merchandise_list
        ]

    except Exception as e:
        logger.exception(f"Error listing trip merchandise: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while listing trip merchandise.",
        )


@router.get(
    "/{trip_merchandise_id}",
    response_model=TripMerchandisePublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def get_trip_merchandise(
    *,
    session: Session = Depends(deps.get_db),
    trip_merchandise_id: uuid.UUID,
) -> TripMerchandisePublic:
    """
    Get trip merchandise by ID.
    """
    try:
        trip_merchandise = session.get(TripMerchandise, trip_merchandise_id)
        if not trip_merchandise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip merchandise with ID {trip_merchandise_id} not found",
            )

        return TripMerchandisePublic.model_validate(trip_merchandise)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            f"Error retrieving trip merchandise {trip_merchandise_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while retrieving trip merchandise.",
        )


@router.put(
    "/{trip_merchandise_id}",
    response_model=TripMerchandisePublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_trip_merchandise(
    *,
    session: Session = Depends(deps.get_db),
    trip_merchandise_id: uuid.UUID,
    trip_merchandise_in: TripMerchandiseUpdate,
) -> TripMerchandisePublic:
    """
    Update trip merchandise.
    """
    try:
        trip_merchandise = session.get(TripMerchandise, trip_merchandise_id)
        if not trip_merchandise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip merchandise with ID {trip_merchandise_id} not found",
            )

        # Update fields
        update_data = trip_merchandise_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(trip_merchandise, field, value)

        session.add(trip_merchandise)
        session.commit()
        session.refresh(trip_merchandise)

        logger.info(f"Updated trip merchandise: {trip_merchandise_id}")
        return TripMerchandisePublic.model_validate(trip_merchandise)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            f"Error updating trip merchandise {trip_merchandise_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while updating trip merchandise.",
        )


@router.delete(
    "/{trip_merchandise_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_trip_merchandise(
    *,
    session: Session = Depends(deps.get_db),
    trip_merchandise_id: uuid.UUID,
) -> None:
    """
    Delete trip merchandise.
    """
    try:
        trip_merchandise = session.get(TripMerchandise, trip_merchandise_id)
        if not trip_merchandise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip merchandise with ID {trip_merchandise_id} not found",
            )

        session.delete(trip_merchandise)
        session.commit()

        logger.info(f"Deleted trip merchandise: {trip_merchandise_id}")

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            f"Error deleting trip merchandise {trip_merchandise_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while deleting trip merchandise.",
        )
