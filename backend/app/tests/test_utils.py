"""Tests for app.utils (email, slug, token helpers)."""

from app.utils import (
    _LAUNCH_UPDATE_FOOTER_PRIORITY,
    _LAUNCH_UPDATE_FOOTER_STANDARD,
    generate_booking_confirmation_email,
    generate_booking_refunded_email,
    generate_launch_update_email,
    generate_password_reset_token,
    generate_slug,
    render_email_template,
    verify_password_reset_token,
)


def test_generate_slug_basic() -> None:
    assert generate_slug("Hello World") == "hello-world"


def test_generate_slug_lowercase() -> None:
    assert generate_slug("UPPERCASE") == "uppercase"


def test_generate_slug_special_chars() -> None:
    assert generate_slug("Hello! @World#") == "hello-world"


def test_generate_slug_multiple_spaces() -> None:
    assert generate_slug("a    b") == "a-b"


def test_generate_slug_leading_trailing_hyphens() -> None:
    assert generate_slug("  hello  ") == "hello"


def test_verify_password_reset_token_invalid_returns_none() -> None:
    assert verify_password_reset_token("invalid.token.here") is None


def test_verify_password_reset_token_valid_returns_email() -> None:
    token = generate_password_reset_token("user@example.com")
    assert token
    email = verify_password_reset_token(token)
    assert email == "user@example.com"


def test_render_email_template_minimal() -> None:
    html = render_email_template(
        template_name="test_email.html",
        context={
            "project_name": "Test Project",
            "base_url": "https://example.com",
            "email": "test@example.com",
        },
    )
    assert "Test Project" in html
    assert "test@example.com" in html
    assert "https://example.com" in html


def test_render_email_template_with_booking_items() -> None:
    """Covers the booking_items pre-process branch; template may not render it."""
    html = render_email_template(
        template_name="test_email.html",
        context={
            "project_name": "P",
            "base_url": "https://x.com",
            "email": "e@e.com",
            "booking_items": [
                {"type": "Adult", "quantity": 2, "price_per_unit": 50.0},
            ],
        },
    )
    assert "P" in html and "e@e.com" in html


def test_render_email_template_with_experience_display() -> None:
    """Covers the experience_display pre-process branch; template may not render it."""
    html = render_email_template(
        template_name="test_email.html",
        context={
            "project_name": "P",
            "base_url": "https://x.com",
            "email": "e@e.com",
            "experience_display": {
                "mission_name": "Mars Mission",
                "launch_name": "Falcon 9",
                "trip_type": "launch_viewing",
                "provider_name": "Space Co",
                "boat_name": "Vessel One",
                "departure_location": "Port Canaveral",
            },
        },
    )
    assert "P" in html and "e@e.com" in html


def test_render_email_template_experience_display_with_map_link() -> None:
    """Covers the experience_display map_link branch."""
    html = render_email_template(
        template_name="test_email.html",
        context={
            "project_name": "P",
            "base_url": "https://x.com",
            "email": "e@e.com",
            "experience_display": {
                "departure_location": "Port Canaveral",
                "map_link": "https://maps.example.com",
            },
        },
    )
    assert "P" in html


def test_generate_launch_update_email_standard_footer() -> None:
    data = generate_launch_update_email(
        email_to="customer@example.com",
        user_name="Jane Doe",
        confirmation_code="ABC123",
        mission_name="Mars Launch",
        update_message="Launch window moved to 3pm.",
        priority=False,
    )
    assert "ABC123" in data.html_content
    assert _LAUNCH_UPDATE_FOOTER_STANDARD in data.html_content
    assert _LAUNCH_UPDATE_FOOTER_PRIORITY not in data.html_content


def test_generate_launch_update_email_priority_footer() -> None:
    data = generate_launch_update_email(
        email_to="customer@example.com",
        user_name="Jane Doe",
        confirmation_code="ABC123",
        mission_name="Mars Launch",
        update_message="Trip cancelled due to weather.",
        priority=True,
    )
    assert _LAUNCH_UPDATE_FOOTER_PRIORITY in data.html_content
    assert _LAUNCH_UPDATE_FOOTER_STANDARD not in data.html_content


def test_generate_launch_update_email_preserves_whitespace() -> None:
    data = generate_launch_update_email(
        email_to="customer@example.com",
        user_name="Jane Doe",
        confirmation_code="ABC123",
        mission_name="Mars Launch",
        update_message="First paragraph.\n\nSecond paragraph.",
    )
    assert "preserved-whitespace" in data.html_content
    assert "white-space: pre-wrap" in data.html_content
    assert "First paragraph." in data.html_content
    assert "Second paragraph." in data.html_content


def test_generate_booking_refunded_email_includes_reason() -> None:
    data = generate_booking_refunded_email(
        email_to="customer@example.com",
        user_name="Jane Doe",
        confirmation_code="ABC123",
        mission_name="Mars Launch",
        refund_amount=99.99,
        refund_reason="Weather conditions",
    )
    assert "Refund Processed" in data.subject
    assert "Weather conditions" in data.html_content
    assert "<strong>Reason:</strong>" in data.html_content


def test_generate_booking_refunded_email_omits_reason_when_absent() -> None:
    data = generate_booking_refunded_email(
        email_to="customer@example.com",
        user_name="Jane Doe",
        confirmation_code="ABC123",
        mission_name="Mars Launch",
        refund_amount=99.99,
    )
    assert "<strong>Reason:</strong>" not in data.html_content


def test_generate_booking_confirmation_email() -> None:
    data = generate_booking_confirmation_email(
        email_to="customer@example.com",
        user_name="Jane Doe",
        confirmation_code="ABC123",
        mission_name="Mars Launch",
        booking_items=[{"type": "Adult", "quantity": 1, "price_per_unit": 99.99}],
        total_amount=99.99,
    )
    assert "ABC123" in data.subject
    assert "Booking Confirmation" in data.subject or "Confirmation" in data.subject
    assert "ABC123" in data.html_content
    assert "Jane Doe" in data.html_content
    assert "Mars Launch" in data.html_content
    assert "/api/v1/bookings/qr/ABC123" in data.html_content
    assert "data:image/png;base64" not in data.html_content
