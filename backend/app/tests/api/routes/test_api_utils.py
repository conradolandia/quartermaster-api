"""Tests for utils API routes."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.config import settings


def test_health_check(client: TestClient) -> None:
    r = client.get(f"{settings.API_V1_STR}/utils/health-check/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_us_states(client: TestClient) -> None:
    r = client.get(f"{settings.API_V1_STR}/utils/us-states/")
    assert r.status_code == 200
    data = r.json()["data"]
    assert isinstance(data, list)
    assert any(s["code"] == "FL" for s in data)


@patch("app.api.routes.utils.send_email")
@patch("app.api.routes.utils.generate_test_email")
def test_test_email(
    mock_generate,
    mock_send,
    client: TestClient,
    superuser_token_headers: dict[str, str],
) -> None:
    mock_generate.return_value.subject = "Test"
    mock_generate.return_value.html_content = "<p>test</p>"
    r = client.post(
        f"{settings.API_V1_STR}/utils/test-email/",
        headers=superuser_token_headers,
        params={"email_to": "admin@example.com"},
    )
    assert r.status_code == 201
    mock_send.assert_called_once()
