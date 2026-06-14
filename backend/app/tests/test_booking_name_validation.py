"""Tests for booking first/last name validation."""

import pytest

from app.models.booking import _validate_name_part


def test_validate_name_part_allows_periods() -> None:
    assert _validate_name_part("C.A.M.", 128) == "C.A.M."
    assert _validate_name_part("A.C.", 128) == "A.C."


def test_validate_name_part_allows_spaces_and_hyphens() -> None:
    assert _validate_name_part("Mary Jane", 128) == "Mary Jane"
    assert _validate_name_part("Jean-Paul", 128) == "Jean-Paul"


def test_validate_name_part_rejects_double_quotes() -> None:
    with pytest.raises(ValueError, match="double quotes"):
        _validate_name_part('John "Johnny"', 128)


def test_validate_name_part_rejects_invalid_characters() -> None:
    with pytest.raises(ValueError, match="can only contain"):
        _validate_name_part("John@Doe", 128)
