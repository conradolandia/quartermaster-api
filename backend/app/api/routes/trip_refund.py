"""Trip-scoped bulk refund endpoints (admin only)."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, SQLModel

from app import crud
from app.api import deps
from app.services.trip_refund import (
    SKIP_REASON_LABELS,
    get_trip_refund_preview,
    refund_trip_paid_bookings,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trips", tags=["trips"])


class RefundableBookingSummary(SQLModel):
    confirmation_code: str
    refund_amount_cents: int
    booking_status: str
    payment_status: str | None = None


class SkippedBookingSummary(SQLModel):
    confirmation_code: str
    refund_amount_cents: int
    booking_status: str
    payment_status: str | None = None
    skip_reason: str
    skip_reason_label: str


class TripRefundableBookingsPublic(SQLModel):
    count: int
    total_refundable_cents: int
    bookings: list[RefundableBookingSummary]
    skipped_count: int
    skipped_total_cents: int
    skipped: list[SkippedBookingSummary]
    trip_sales_cents: int
    committed_passengers: int


class TripBulkRefundRequest(BaseModel):
    refund_reason: str
    refund_notes: str | None = None


class TripRefundFailure(SQLModel):
    confirmation_code: str
    detail: str


class TripBulkRefundResult(SQLModel):
    refunded_count: int
    failed_count: int
    total_refunded_cents: int
    failures: list[TripRefundFailure]


@router.get(
    "/{trip_id}/refundable-bookings",
    response_model=TripRefundableBookingsPublic,
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def read_trip_refundable_bookings(
    trip_id: uuid.UUID,
    session: Session = Depends(deps.get_db),
) -> TripRefundableBookingsPublic:
    """Preview confirmed paid bookings on a trip that can be fully refunded via Stripe."""
    trip = crud.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} not found",
        )

    preview = get_trip_refund_preview(session=session, trip_id=trip_id)
    eligible_summaries = [
        RefundableBookingSummary(
            confirmation_code=row.confirmation_code,
            refund_amount_cents=row.refund_amount_cents,
            booking_status=row.booking_status,
            payment_status=row.payment_status,
        )
        for row in preview.eligible
    ]
    skipped_summaries = [
        SkippedBookingSummary(
            confirmation_code=row.confirmation_code,
            refund_amount_cents=row.refund_amount_cents,
            booking_status=row.booking_status,
            payment_status=row.payment_status,
            skip_reason=row.skip_reason or "not_paid",
            skip_reason_label=SKIP_REASON_LABELS.get(
                row.skip_reason or "not_paid", row.skip_reason or "Skipped"
            ),
        )
        for row in preview.skipped
    ]
    total_refundable = sum(s.refund_amount_cents for s in eligible_summaries)
    skipped_total = sum(s.refund_amount_cents for s in skipped_summaries)

    return TripRefundableBookingsPublic(
        count=len(eligible_summaries),
        total_refundable_cents=total_refundable,
        bookings=eligible_summaries,
        skipped_count=len(skipped_summaries),
        skipped_total_cents=skipped_total,
        skipped=skipped_summaries,
        trip_sales_cents=preview.trip_sales_cents,
        committed_passengers=preview.committed_passengers,
    )


@router.post(
    "/{trip_id}/refund-paid-bookings",
    response_model=TripBulkRefundResult,
    dependencies=[Depends(deps.get_current_active_superuser)],
)
def refund_trip_paid_bookings_endpoint(
    trip_id: uuid.UUID,
    body: TripBulkRefundRequest,
    session: Session = Depends(deps.get_db),
) -> TripBulkRefundResult:
    """
    Fully refund all confirmed paid bookings on a trip with a Stripe payment.
    Skips ineligible bookings. Continues processing when individual refunds fail.
    """
    trip = crud.get_trip(session=session, trip_id=trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with ID {trip_id} not found",
        )

    if not body.refund_reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refund reason is required.",
        )

    refunded, failures = refund_trip_paid_bookings(
        session=session,
        trip_id=trip_id,
        refund_reason=body.refund_reason.strip(),
        refund_notes=body.refund_notes.strip() if body.refund_notes else None,
    )

    total_refunded_cents = sum(b.refunded_amount_cents or 0 for b in refunded)
    failure_models = [
        TripRefundFailure(confirmation_code=code, detail=detail)
        for code, detail in failures
    ]

    logger.info(
        "Trip bulk refund trip_id=%s refunded=%s failed=%s total_cents=%s",
        trip_id,
        len(refunded),
        len(failures),
        total_refunded_cents,
    )

    return TripBulkRefundResult(
        refunded_count=len(refunded),
        failed_count=len(failures),
        total_refunded_cents=total_refunded_cents,
        failures=failure_models,
    )
