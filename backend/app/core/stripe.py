import stripe
from fastapi import HTTPException, status

from app.core.config import settings

# Initialize Stripe with the secret key
stripe.api_key = settings.STRIPE_SECRET_KEY


def create_payment_intent(amount: int, currency: str = "usd") -> stripe.PaymentIntent:
    """
    Create a Stripe PaymentIntent for the specified amount.

    Args:
        amount: Amount in cents (e.g., 1000 for $10.00)
        currency: Currency code (default: "usd")

    Returns:
        stripe.PaymentIntent: The created payment intent

    Raises:
        HTTPException: If there's an error creating the payment intent
    """
    try:
        return stripe.PaymentIntent.create(
            amount=amount,
            currency=currency,
            automatic_payment_methods={"enabled": True},
        )
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating payment intent: {str(e)}",
        )


def retrieve_payment_intent(payment_intent_id: str) -> stripe.PaymentIntent:
    """
    Retrieve a Stripe PaymentIntent by its ID.

    Args:
        payment_intent_id: The ID of the payment intent to retrieve

    Returns:
        stripe.PaymentIntent: The retrieved payment intent

    Raises:
        HTTPException: If there's an error retrieving the payment intent
    """
    try:
        return stripe.PaymentIntent.retrieve(payment_intent_id)
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error retrieving payment intent: {str(e)}",
        )


def refund_payment(payment_intent_id: str, amount: int | None = None) -> stripe.Refund:
    """
    Refund a payment through Stripe.

    Args:
        payment_intent_id: The ID of the payment intent to refund
        amount: Optional amount to refund in cents. If None, refunds the full amount.

    Returns:
        stripe.Refund: The created refund

    Raises:
        HTTPException: If there's an error processing the refund
    """
    try:
        refund_params = {"payment_intent": payment_intent_id}
        if amount is not None:
            refund_params["amount"] = amount

        return stripe.Refund.create(**refund_params)
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error processing refund: {str(e)}",
        )
