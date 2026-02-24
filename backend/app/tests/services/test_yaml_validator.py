"""
Tests for app.services.yaml_validator module.
"""

import pytest

from app.services.yaml_validator import YamlValidationError, YamlValidator


class TestValidateYamlContentLaunch:
    """Tests for validate_yaml_content with launch schema."""

    def test_valid_launch(self) -> None:
        yaml_content = """
name: "Falcon 9 Launch"
launch_timestamp: "2025-06-15T10:00:00Z"
summary: "Starlink mission"
location_id: "550e8400-e29b-41d4-a716-446655440000"
"""
        result = YamlValidator.validate_yaml_content(yaml_content, "launch")
        assert result["name"] == "Falcon 9 Launch"
        assert result["summary"] == "Starlink mission"

    def test_launch_missing_required_field(self) -> None:
        yaml_content = """
name: "Falcon 9 Launch"
launch_timestamp: "2025-06-15T10:00:00Z"
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_yaml_content(yaml_content, "launch")
        assert "Missing required fields" in str(exc_info.value)

    def test_launch_invalid_field_type(self) -> None:
        yaml_content = """
name: 123
launch_timestamp: "2025-06-15T10:00:00Z"
summary: "Starlink mission"
location_id: "550e8400-e29b-41d4-a716-446655440000"
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_yaml_content(yaml_content, "launch")
        assert "must be a string" in str(exc_info.value)


class TestValidateYamlContentMission:
    """Tests for validate_yaml_content with mission schema."""

    def test_valid_mission(self) -> None:
        yaml_content = """
name: "Starlink Viewing"
launch_id: "550e8400-e29b-41d4-a716-446655440000"
active: true
refund_cutoff_hours: 24
"""
        result = YamlValidator.validate_yaml_content(yaml_content, "mission")
        assert result["name"] == "Starlink Viewing"
        assert result["active"] is True

    def test_mission_missing_launch_id(self) -> None:
        yaml_content = """
name: "Starlink Viewing"
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_yaml_content(yaml_content, "mission")
        assert "Missing required fields" in str(exc_info.value)


class TestValidateYamlContentTrip:
    """Tests for validate_yaml_content with trip schema."""

    def test_valid_trip(self) -> None:
        yaml_content = """
mission_id: "550e8400-e29b-41d4-a716-446655440000"
type: "launch_viewing"
departure_time: "2025-06-15T08:00:00Z"
name: "Morning Trip"
active: true
"""
        result = YamlValidator.validate_yaml_content(yaml_content, "trip")
        assert result["type"] == "launch_viewing"
        assert result["name"] == "Morning Trip"

    def test_trip_missing_required_fields(self) -> None:
        yaml_content = """
name: "Morning Trip"
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_yaml_content(yaml_content, "trip")
        assert "Missing required fields" in str(exc_info.value)

    def test_trip_with_offsets(self) -> None:
        yaml_content = """
mission_id: "550e8400-e29b-41d4-a716-446655440000"
type: "launch_viewing"
departure_time: "2025-06-15T08:00:00Z"
boarding_minutes_before_departure: 30
checkin_minutes_before_boarding: 30
"""
        result = YamlValidator.validate_yaml_content(yaml_content, "trip")
        assert result["boarding_minutes_before_departure"] == 30
        assert result["checkin_minutes_before_boarding"] == 30


class TestValidateYamlContentGeneral:
    """General tests for validate_yaml_content."""

    def test_empty_yaml(self) -> None:
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_yaml_content("", "launch")
        assert "empty or invalid" in str(exc_info.value)

    def test_invalid_yaml_syntax(self) -> None:
        yaml_content = """
name: "Test
  invalid: yaml
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_yaml_content(yaml_content, "launch")
        assert "Invalid YAML format" in str(exc_info.value)

    def test_unknown_schema_type(self) -> None:
        yaml_content = """
name: "Test"
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_yaml_content(yaml_content, "unknown")
        assert "Unknown schema type" in str(exc_info.value)


class TestValidateMultiDocument:
    """Tests for validate_multi_document method."""

    def test_valid_multi_document_with_launches_only(self) -> None:
        yaml_content = """
launches:
  - name: "Falcon 9 Launch"
    launch_timestamp: "2025-06-15T10:00:00Z"
    summary: "Starlink mission"
    location_id: "550e8400-e29b-41d4-a716-446655440000"
"""
        result = YamlValidator.validate_multi_document(yaml_content)
        assert "launches" in result
        assert len(result["launches"]) == 1

    def test_valid_multi_document_with_missions_using_launch_ref(self) -> None:
        yaml_content = """
launches:
  - name: "Falcon 9 Launch"
    launch_timestamp: "2025-06-15T10:00:00Z"
    summary: "Starlink mission"
    location_id: "550e8400-e29b-41d4-a716-446655440000"
missions:
  - name: "Starlink Viewing"
    launch_ref: 0
"""
        result = YamlValidator.validate_multi_document(yaml_content)
        assert "launches" in result
        assert "missions" in result
        assert result["missions"][0]["launch_ref"] == 0

    def test_valid_multi_document_with_trips_using_mission_ref(self) -> None:
        yaml_content = """
launches:
  - name: "Falcon 9 Launch"
    launch_timestamp: "2025-06-15T10:00:00Z"
    summary: "Starlink mission"
    location_id: "550e8400-e29b-41d4-a716-446655440000"
missions:
  - name: "Starlink Viewing"
    launch_ref: 0
trips:
  - type: "launch_viewing"
    departure_time: "2025-06-15T08:00:00Z"
    mission_ref: 0
"""
        result = YamlValidator.validate_multi_document(yaml_content)
        assert "launches" in result
        assert "missions" in result
        assert "trips" in result
        assert result["trips"][0]["mission_ref"] == 0

    def test_mission_with_launch_id_instead_of_ref(self) -> None:
        yaml_content = """
missions:
  - name: "Starlink Viewing"
    launch_id: "550e8400-e29b-41d4-a716-446655440000"
"""
        result = YamlValidator.validate_multi_document(yaml_content)
        assert "missions" in result

    def test_trip_with_mission_id_instead_of_ref(self) -> None:
        yaml_content = """
trips:
  - type: "launch_viewing"
    departure_time: "2025-06-15T08:00:00Z"
    mission_id: "550e8400-e29b-41d4-a716-446655440000"
"""
        result = YamlValidator.validate_multi_document(yaml_content)
        assert "trips" in result

    def test_empty_document_fails(self) -> None:
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_multi_document("")
        assert "non-empty" in str(exc_info.value)

    def test_missing_all_sections_fails(self) -> None:
        yaml_content = """
other_key: "value"
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_multi_document(yaml_content)
        assert "must contain at least one of" in str(exc_info.value)

    def test_launches_not_a_list_fails(self) -> None:
        yaml_content = """
launches:
  name: "Not a list"
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_multi_document(yaml_content)
        assert "'launches' must be a list" in str(exc_info.value)

    def test_missions_not_a_list_fails(self) -> None:
        yaml_content = """
missions:
  name: "Not a list"
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_multi_document(yaml_content)
        assert "'missions' must be a list" in str(exc_info.value)

    def test_trips_not_a_list_fails(self) -> None:
        yaml_content = """
trips:
  type: "Not a list"
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_multi_document(yaml_content)
        assert "'trips' must be a list" in str(exc_info.value)

    def test_mission_missing_launch_id_and_ref_fails(self) -> None:
        yaml_content = """
missions:
  - name: "Starlink Viewing"
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_multi_document(yaml_content)
        assert "must have launch_id or launch_ref" in str(exc_info.value)

    def test_trip_missing_mission_id_and_ref_fails(self) -> None:
        yaml_content = """
trips:
  - type: "launch_viewing"
    departure_time: "2025-06-15T08:00:00Z"
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_multi_document(yaml_content)
        assert "must have mission_id or mission_ref" in str(exc_info.value)

    def test_invalid_launch_ref_out_of_range(self) -> None:
        yaml_content = """
launches:
  - name: "Falcon 9 Launch"
    launch_timestamp: "2025-06-15T10:00:00Z"
    summary: "Starlink mission"
    location_id: "550e8400-e29b-41d4-a716-446655440000"
missions:
  - name: "Starlink Viewing"
    launch_ref: 5
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_multi_document(yaml_content)
        assert "launch_ref must be 0..0" in str(exc_info.value)

    def test_invalid_mission_ref_out_of_range(self) -> None:
        yaml_content = """
missions:
  - name: "Starlink Viewing"
    launch_id: "550e8400-e29b-41d4-a716-446655440000"
trips:
  - type: "launch_viewing"
    departure_time: "2025-06-15T08:00:00Z"
    mission_ref: 10
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_multi_document(yaml_content)
        assert "mission_ref must be 0..0" in str(exc_info.value)

    def test_launch_item_not_dict_fails(self) -> None:
        yaml_content = """
launches:
  - "just a string"
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_multi_document(yaml_content)
        assert "launches[0] must be an object" in str(exc_info.value)

    def test_mission_item_not_dict_fails(self) -> None:
        yaml_content = """
missions:
  - "just a string"
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_multi_document(yaml_content)
        assert "missions[0] must be an object" in str(exc_info.value)

    def test_trip_item_not_dict_fails(self) -> None:
        yaml_content = """
trips:
  - "just a string"
"""
        with pytest.raises(YamlValidationError) as exc_info:
            YamlValidator.validate_multi_document(yaml_content)
        assert "trips[0] must be an object" in str(exc_info.value)


class TestYamlValidationError:
    """Tests for YamlValidationError exception."""

    def test_error_message(self) -> None:
        error = YamlValidationError("Test error")
        assert error.message == "Test error"
        assert str(error) == "Test error"

    def test_error_with_errors_list(self) -> None:
        error = YamlValidationError("Test error", ["error1", "error2"])
        assert error.errors == ["error1", "error2"]

    def test_error_default_empty_errors(self) -> None:
        error = YamlValidationError("Test error")
        assert error.errors == []
