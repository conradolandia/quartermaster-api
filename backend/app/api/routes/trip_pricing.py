import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app import crud
from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    TripPricing,
    TripPricingCreate,
    TripPricingPublic,
    TripPricingUpdate,
)

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trip-pricing", tags=["trip-pricing"])


@router.post(
    "/",
    response_model=TripPricingPublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_trip_pricing(
    *,
    session: Session = Depends(deps.get_db),
    trip_pricing_in: TripPricingCreate,
) -> TripPricingPublic:
    """
    Create new trip pricing.
    """
    try:
        # Check if pricing already exists for this trip and ticket type
        existing_pricing = session.exec(
            select(TripPricing).where(
                TripPricing.trip_id == trip_pricing_in.trip_id,
                TripPricing.ticket_type == trip_pricing_in.ticket_type,
            )
        ).first()

        if existing_pricing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Pricing for ticket type '{trip_pricing_in.ticket_type}' already exists for this trip",
            )

        trip_pricing = TripPricing.model_validate(trip_pricing_in)
        session.add(trip_pricing)
        session.commit()
        session.refresh(trip_pricing)

        logger.info(f"Created trip pricing: {trip_pricing.id}")
        return TripPricingPublic.model_validate(trip_pricing)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error creating trip pricing: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating trip pricing.",
        )


@router.get(
    "/",
    response_model=list[TripPricingPublic],
    dependencies=[Depends(get_current_active_superuser)],
)
def list_trip_pricing(
    *,
    session: Session = Depends(deps.get_db),
    trip_id: uuid.UUID | None = None,
    ticket_type: str | None = None,
) -> list[TripPricingPublic]:
    """
    List trip pricing with optional filtering.
    """
    try:
        query = select(TripPricing)

        if trip_id:
            query = query.where(TripPricing.trip_id == trip_id)

        if ticket_type:
            query = query.where(TripPricing.ticket_type == ticket_type)

        trip_pricing_list = session.exec(query).all()
        return [
            TripPricingPublic.model_validate(pricing) for pricing in trip_pricing_list
        ]

    except Exception as e:
        logger.exception(f"Error listing trip pricing: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while listing trip pricing.",
        )


@router.get(
    "/{trip_pricing_id}",
    response_model=TripPricingPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def get_trip_pricing(
    *,
    session: Session = Depends(deps.get_db),
    trip_pricing_id: uuid.UUID,
) -> TripPricingPublic:
    """
    Get trip pricing by ID.
    """
    try:
        trip_pricing = session.get(TripPricing, trip_pricing_id)
        if not trip_pricing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip pricing with ID {trip_pricing_id} not found",
            )

        return TripPricingPublic.model_validate(trip_pricing)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error retrieving trip pricing {trip_pricing_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while retrieving trip pricing.",
        )


@router.put(
    "/{trip_pricing_id}",
    response_model=TripPricingPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_trip_pricing(
    *,
    session: Session = Depends(deps.get_db),
    trip_pricing_id: uuid.UUID,
    trip_pricing_in: TripPricingUpdate,
) -> TripPricingPublic:
    """
    Update trip pricing.
    """
    try:
        trip_pricing = session.get(TripPricing, trip_pricing_id)
        if not trip_pricing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip pricing with ID {trip_pricing_id} not found",
            )

        # Check if updating ticket_type would create a duplicate
        if (
            trip_pricing_in.ticket_type
            and trip_pricing_in.ticket_type != trip_pricing.ticket_type
        ):
            existing_pricing = session.exec(
                select(TripPricing).where(
                    TripPricing.trip_id == trip_pricing.trip_id,
                    TripPricing.ticket_type == trip_pricing_in.ticket_type,
                    TripPricing.id != trip_pricing_id,
                )
            ).first()

            if existing_pricing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Pricing for ticket type '{trip_pricing_in.ticket_type}' already exists for this trip",
                )

        # Update fields
        update_data = trip_pricing_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(trip_pricing, field, value)

        session.add(trip_pricing)
        session.commit()
        session.refresh(trip_pricing)

        logger.info(f"Updated trip pricing: {trip_pricing_id}")
        return TripPricingPublic.model_validate(trip_pricing)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error updating trip pricing {trip_pricing_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while updating trip pricing.",
        )


@router.delete(
    "/{trip_pricing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_active_superuser)],
)
def delete_trip_pricing(
    *,
    session: Session = Depends(deps.get_db),
    trip_pricing_id: uuid.UUID,
) -> None:
    """
    Delete trip pricing.
    """
    try:
        trip_pricing = session.get(TripPricing, trip_pricing_id)
        if not trip_pricing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip pricing with ID {trip_pricing_id} not found",
            )

        session.delete(trip_pricing)
        session.commit()

        logger.info(f"Deleted trip pricing: {trip_pricing_id}")

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error deleting trip pricing {trip_pricing_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while deleting trip pricing.",
        )


# Public endpoint (no authentication required)
@router.get("/public/", response_model=list[TripPricingPublic])
def list_public_trip_pricing(
    *,
    session: Session = Depends(deps.get_db),
    trip_id: uuid.UUID,
) -> list[TripPricingPublic]:
    """
    List trip pricing for a specific trip (public endpoint for booking form).
    Validates that the trip's mission has public or early_bird booking_mode.
    """
    try:
        # Get the trip to check mission booking_mode
        trip = crud.get_trip(session=session, trip_id=trip_id)
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip with ID {trip_id} not found",
            )

        # Check mission booking_mode
        mission = crud.get_mission(session=session, mission_id=trip.mission_id)
        if not mission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mission not found",
            )

        if mission.booking_mode == "private":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tickets are not yet available for this trip",
            )

        query = select(TripPricing).where(TripPricing.trip_id == trip_id)
        trip_pricing_list = session.exec(query).all()
        return [
            TripPricingPublic.model_validate(pricing) for pricing in trip_pricing_list
        ]

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error listing public trip pricing: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while listing trip pricing.",
        )
