import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import (
    DiscountCode,
    DiscountCodeCreate,
    DiscountCodePublic,
    DiscountCodeUpdate,
)

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/discount-codes", tags=["discount-codes"])


@router.post(
    "/",
    response_model=DiscountCodePublic,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_discount_code(
    *,
    session: Session = Depends(deps.get_db),
    discount_code_in: DiscountCodeCreate,
) -> DiscountCodePublic:
    """
    Create new discount code.
    """
    try:
        # Check if discount code already exists
        existing_code = session.exec(
            select(DiscountCode).where(DiscountCode.code == discount_code_in.code)
        ).first()

        if existing_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Discount code '{discount_code_in.code}' already exists",
            )

        discount_code = DiscountCode.model_validate(discount_code_in)
        session.add(discount_code)
        session.commit()
        session.refresh(discount_code)

        logger.info(f"Created discount code: {discount_code.id}")
        return DiscountCodePublic.model_validate(discount_code)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error creating discount code: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while creating discount code.",
        )


@router.get(
    "/",
    response_model=list[DiscountCodePublic],
    dependencies=[Depends(get_current_active_superuser)],
)
def list_discount_codes(
    *,
    session: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    is_active: bool | None = None,
) -> list[DiscountCodePublic]:
    """
    Retrieve discount codes.
    """
    try:
        query = select(DiscountCode)

        if is_active is not None:
            query = query.where(DiscountCode.is_active == is_active)

        query = query.offset(skip).limit(limit)

        discount_codes = session.exec(query).all()
        return [DiscountCodePublic.model_validate(dc) for dc in discount_codes]

    except Exception as e:
        logger.exception(f"Error retrieving discount codes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while retrieving discount codes.",
        )


@router.get(
    "/{discount_code_id}",
    response_model=DiscountCodePublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def get_discount_code(
    *,
    session: Session = Depends(deps.get_db),
    discount_code_id: uuid.UUID,
) -> DiscountCodePublic:
    """
    Get discount code by ID.
    """
    try:
        discount_code = session.get(DiscountCode, discount_code_id)
        if not discount_code:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Discount code not found",
            )
        return DiscountCodePublic.model_validate(discount_code)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error retrieving discount code: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while retrieving discount code.",
        )


@router.put(
    "/{discount_code_id}",
    response_model=DiscountCodePublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_discount_code(
    *,
    session: Session = Depends(deps.get_db),
    discount_code_id: uuid.UUID,
    discount_code_in: DiscountCodeUpdate,
) -> DiscountCodePublic:
    """
    Update discount code.
    """
    try:
        discount_code = session.get(DiscountCode, discount_code_id)
        if not discount_code:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Discount code not found",
            )

        # Check if new code already exists (if code is being updated)
        if discount_code_in.code and discount_code_in.code != discount_code.code:
            existing_code = session.exec(
                select(DiscountCode).where(DiscountCode.code == discount_code_in.code)
            ).first()
            if existing_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Discount code '{discount_code_in.code}' already exists",
                )

        # Update fields
        update_data = discount_code_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(discount_code, field, value)

        discount_code.updated_at = datetime.now(timezone.utc)
        session.add(discount_code)
        session.commit()
        session.refresh(discount_code)

        logger.info(f"Updated discount code: {discount_code.id}")
        return DiscountCodePublic.model_validate(discount_code)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error updating discount code: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while updating discount code.",
        )


@router.delete(
    "/{discount_code_id}", dependencies=[Depends(get_current_active_superuser)]
)
def delete_discount_code(
    *,
    session: Session = Depends(deps.get_db),
    discount_code_id: uuid.UUID,
) -> dict[str, str]:
    """
    Delete discount code.
    """
    try:
        discount_code = session.get(DiscountCode, discount_code_id)
        if not discount_code:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Discount code not found",
            )

        session.delete(discount_code)
        session.commit()

        logger.info(f"Deleted discount code: {discount_code_id}")
        return {"message": "Discount code deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error deleting discount code: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while deleting discount code.",
        )


@router.get("/validate/{code}", response_model=DiscountCodePublic)
def validate_discount_code(
    *,
    session: Session = Depends(deps.get_db),
    code: str,
    subtotal: float = 0,
) -> DiscountCodePublic:
    """
    Validate discount code and return details if valid.
    """
    try:
        discount_code = session.exec(
            select(DiscountCode).where(DiscountCode.code == code)
        ).first()

        if not discount_code:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Discount code not found",
            )

        # Check if code is active
        if not discount_code.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Discount code is not active",
            )

        # Check validity dates
        now = datetime.now(timezone.utc)
        if discount_code.valid_from and now < discount_code.valid_from:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Discount code is not yet valid",
            )

        if discount_code.valid_until and now > discount_code.valid_until:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Discount code has expired",
            )

        # Check usage limits
        if (
            discount_code.max_uses
            and discount_code.used_count >= discount_code.max_uses
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Discount code has reached maximum usage limit",
            )

        # Check minimum order amount
        if discount_code.min_order_amount and subtotal < discount_code.min_order_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Minimum order amount of ${discount_code.min_order_amount} required for this discount code",
            )

        return DiscountCodePublic.model_validate(discount_code)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error validating discount code: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while validating discount code.",
        )
