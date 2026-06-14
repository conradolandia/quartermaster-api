"""Tests for check-in QR URL construction."""

from app.api.routes.booking_utils import build_check_in_qr_url


def test_build_check_in_qr_url_includes_auto_check_in(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.routes.booking_utils.settings.QR_CODE_BASE_URL",
        "https://admin.example.com",
    )
    assert (
        build_check_in_qr_url("YABW9RS5")
        == "https://admin.example.com/check-in?code=YABW9RS5&check_in=true"
    )


def test_build_check_in_qr_url_without_auto_check_in(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.routes.booking_utils.settings.QR_CODE_BASE_URL",
        "https://admin.example.com",
    )
    assert (
        build_check_in_qr_url("YABW9RS5", auto_check_in=False)
        == "https://admin.example.com/check-in?code=YABW9RS5"
    )


def test_build_check_in_qr_url_falls_back_to_frontend_host(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.api.routes.booking_utils.settings.QR_CODE_BASE_URL",
        None,
    )
    monkeypatch.setattr(
        "app.api.routes.booking_utils.settings.FRONTEND_HOST",
        "http://localhost:5173",
    )
    assert (
        build_check_in_qr_url("ABC")
        == "http://localhost:5173/check-in?code=ABC&check_in=true"
    )
