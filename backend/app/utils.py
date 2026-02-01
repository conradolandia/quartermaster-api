import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import emails  # type: ignore
import jwt
from jinja2 import Template
from jwt.exceptions import InvalidTokenError

from app.core import security
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class EmailData:
    html_content: str
    subject: str


def render_email_template(*, template_name: str, context: dict[str, Any]) -> str:
    template_str = (
        Path(__file__).parent / "email-templates" / "build" / template_name
    ).read_text()

    # Pre-process booking items to a static HTML format if they exist in the context
    if "booking_items" in context and context["booking_items"]:
        items_html = ""
        for item in context["booking_items"]:
            items_html += f"{item['quantity']}x {item['type']} - ${item['price_per_unit']:.2f} each<br>"
        context["booking_items_html"] = items_html

    html_content = Template(template_str).render(context)
    return html_content


def send_email(
    *,
    email_to: str,
    subject: str = "",
    html_content: str = "",
) -> None:
    assert settings.emails_enabled, "no provided configuration for email variables"
    message = emails.Message(
        subject=subject,
        html=html_content,
        mail_from=(settings.EMAILS_FROM_NAME, settings.EMAILS_FROM_EMAIL),
    )
    smtp_options = {"host": settings.SMTP_HOST, "port": settings.SMTP_PORT}
    if settings.SMTP_TLS:
        smtp_options["tls"] = True
    elif settings.SMTP_SSL:
        smtp_options["ssl"] = True
    if settings.SMTP_USER:
        smtp_options["user"] = settings.SMTP_USER
    if settings.SMTP_PASSWORD:
        smtp_options["password"] = settings.SMTP_PASSWORD

    logger.info(f"Sending email to {email_to} with SMTP options: {smtp_options}")
    response = message.send(to=email_to, smtp=smtp_options)
    logger.info(f"Send email result: {response}")
    logger.info(f"Response dict: {response.__dict__}")


def generate_test_email(email_to: str) -> EmailData:
    email_brand = settings.EMAIL_BRAND_NAME or settings.PROJECT_NAME
    subject = f"{email_brand} - Test email"
    base_url = settings.FRONTEND_HOST
    html_content = render_email_template(
        template_name="test_email.html",
        context={
            "project_name": email_brand,
            "base_url": base_url,
            "email": email_to,
        },
    )
    return EmailData(html_content=html_content, subject=subject)


def generate_booking_confirmation_email(
    *,
    email_to: str,
    user_name: str,
    confirmation_code: str,
    mission_name: str,
    booking_items: list[dict],
    total_amount: float,
    qr_code_base64: str | None = None,
) -> EmailData:
    """
    Generate booking confirmation email with booking details and tickets.

    Args:
        email_to: Recipient's email address
        user_name: Customer's name
        confirmation_code: Unique booking confirmation code
        mission_name: Name of the mission/launch
        booking_items: List of booked items with details
        total_amount: Total amount paid
        qr_code_base64: Optional base64-encoded PNG of the booking QR code for the email

    Returns:
        EmailData containing the subject and HTML content
    """
    email_brand = settings.EMAIL_BRAND_NAME or settings.PROJECT_NAME
    subject = f"{email_brand} - Booking Confirmation #{confirmation_code}"

    # Create the confirmation link (unified public route)
    base_url = settings.FRONTEND_HOST
    confirmation_link = f"{base_url}/bookings?code={confirmation_code}"

    qr_b64 = qr_code_base64 or ""
    logger.info(
        "Booking confirmation email: confirmation_code=%s qr_code_len=%s",
        confirmation_code,
        len(qr_b64),
    )

    # Render the email template
    html_content = render_email_template(
        template_name="booking_confirmation.html",
        context={
            "project_name": email_brand,
            "base_url": base_url,
            "user_name": user_name,
            "confirmation_code": confirmation_code,
            "mission_name": mission_name,
            "booking_items": booking_items,
            "total_amount": total_amount,
            "confirmation_link": confirmation_link,
            "email": email_to,
            "qr_code_base64": qr_b64,
            "is_cancellation": False,  # Explicitly set to False for regular bookings
            "is_refund": False,  # Explicitly set to False for regular bookings
        },
    )

    return EmailData(html_content=html_content, subject=subject)


def generate_booking_cancelled_email(
    *,
    email_to: str,
    user_name: str,
    confirmation_code: str,
    mission_name: str,
) -> EmailData:
    """
    Generate booking cancellation email.

    Args:
        email_to: Recipient's email address
        user_name: Customer's name
        confirmation_code: Unique booking confirmation code
        mission_name: Name of the mission/launch

    Returns:
        EmailData containing the subject and HTML content
    """
    email_brand = settings.EMAIL_BRAND_NAME or settings.PROJECT_NAME
    subject = f"{email_brand} - Booking Cancellation #{confirmation_code}"

    base_url = settings.FRONTEND_HOST
    # Use the confirmation template for now, with a custom message
    # A dedicated cancellation template could be created later
    html_content = render_email_template(
        template_name="booking_confirmation.html",  # Reuse existing template as a base
        context={
            "project_name": email_brand,
            "base_url": base_url,
            "user_name": user_name,
            "confirmation_code": confirmation_code,
            "mission_name": mission_name,
            "booking_items": [],
            "total_amount": 0.0,
            "confirmation_link": f"{base_url}/bookings?code={confirmation_code}",
            "is_cancellation": True,  # Flag for template conditional
            "cancellation_message": f"Your booking #{confirmation_code} for {mission_name} has been cancelled.",
            "email": email_to,
        },
    )

    return EmailData(html_content=html_content, subject=subject)


def generate_booking_refunded_email(
    *,
    email_to: str,
    user_name: str,
    confirmation_code: str,
    mission_name: str,
    refund_amount: float,
) -> EmailData:
    """
    Generate booking refund email.

    Args:
        email_to: Recipient's email address
        user_name: Customer's name
        confirmation_code: Unique booking confirmation code
        mission_name: Name of the mission/launch
        refund_amount: Total amount refunded

    Returns:
        EmailData containing the subject and HTML content
    """
    email_brand = settings.EMAIL_BRAND_NAME or settings.PROJECT_NAME
    subject = f"{email_brand} - Refund Processed for Booking #{confirmation_code}"

    base_url = settings.FRONTEND_HOST
    # Use the confirmation template for now, with a custom message
    # A dedicated refund template could be created later
    html_content = render_email_template(
        template_name="booking_confirmation.html",  # Reuse existing template as a base
        context={
            "project_name": email_brand,
            "base_url": base_url,
            "user_name": user_name,
            "confirmation_code": confirmation_code,
            "mission_name": mission_name,
            "booking_items": [],
            "total_amount": refund_amount,
            "confirmation_link": f"{base_url}/bookings?code={confirmation_code}",
            "is_refund": True,  # Flag for template conditional
            "refund_message": f"Your refund of ${refund_amount:.2f} for booking #{confirmation_code} has been processed.",
            "email": email_to,
        },
    )

    return EmailData(html_content=html_content, subject=subject)


def generate_launch_update_email(
    *,
    email_to: str,
    user_name: str,
    confirmation_code: str,
    mission_name: str,
    update_message: str,
) -> EmailData:
    """
    Generate launch update email for customers who opted in.

    Args:
        email_to: Recipient's email address
        user_name: Customer's name
        confirmation_code: Unique booking confirmation code
        mission_name: Name of the mission/launch
        update_message: The update message to send

    Returns:
        EmailData containing the subject and HTML content
    """
    email_brand = settings.EMAIL_BRAND_NAME or settings.PROJECT_NAME
    subject = f"{email_brand} - Launch Update: {mission_name}"

    # Create the confirmation link
    base_url = settings.FRONTEND_HOST
    confirmation_link = f"{base_url}/bookings?code={confirmation_code}"

    # Render the email template
    html_content = render_email_template(
        template_name="launch_update.html",
        context={
            "project_name": email_brand,
            "base_url": base_url,
            "user_name": user_name,
            "confirmation_code": confirmation_code,
            "mission_name": mission_name,
            "update_message": update_message,
            "confirmation_link": confirmation_link,
            "email": email_to,
        },
    )

    return EmailData(html_content=html_content, subject=subject)


def generate_reset_password_email(email_to: str, email: str, token: str) -> EmailData:
    email_brand = settings.EMAIL_BRAND_NAME or settings.PROJECT_NAME
    subject = f"{email_brand} - Password recovery for user {email}"
    base_url = settings.FRONTEND_HOST
    link = f"{base_url}/reset-password?token={token}"
    html_content = render_email_template(
        template_name="reset_password.html",
        context={
            "project_name": email_brand,
            "base_url": base_url,
            "username": email,
            "email": email_to,
            "valid_hours": settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS,
            "link": link,
        },
    )
    return EmailData(html_content=html_content, subject=subject)


def generate_new_account_email(
    email_to: str, username: str, password: str
) -> EmailData:
    email_brand = settings.EMAIL_BRAND_NAME or settings.PROJECT_NAME
    subject = f"{email_brand} - New account for user {username}"
    base_url = settings.FRONTEND_HOST
    html_content = render_email_template(
        template_name="new_account.html",
        context={
            "project_name": email_brand,
            "base_url": base_url,
            "username": username,
            "password": password,
            "email": email_to,
            "link": base_url,
        },
    )
    return EmailData(html_content=html_content, subject=subject)


def generate_password_reset_token(email: str) -> str:
    delta = timedelta(hours=settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS)
    now = datetime.now(timezone.utc)
    expires = now + delta
    exp = expires.timestamp()
    encoded_jwt = jwt.encode(
        {"exp": exp, "nbf": now, "sub": email},
        settings.SECRET_KEY,
        algorithm=security.ALGORITHM,
    )
    return encoded_jwt


def verify_password_reset_token(token: str) -> str | None:
    try:
        decoded_token = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        return str(decoded_token["sub"])
    except InvalidTokenError:
        return None


def generate_slug(text: str) -> str:
    """
    Convert a string to a URL-friendly slug.

    Args:
        text: The string to convert to a slug

    Returns:
        A URL-friendly slug
    """
    # Convert to lowercase
    slug = text.lower()

    # Replace spaces with hyphens
    slug = re.sub(r"\s+", "-", slug)

    # Remove special characters
    slug = re.sub(r"[^a-z0-9-]", "", slug)

    # Remove duplicate hyphens
    slug = re.sub(r"-+", "-", slug)

    # Remove leading and trailing hyphens
    slug = slug.strip("-")

    return slug
