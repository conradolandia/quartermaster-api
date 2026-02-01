import logging
from typing import Any

import yaml

logger = logging.getLogger(__name__)


class YamlValidationError(Exception):
    """Custom exception for YAML validation errors"""

    def __init__(self, message: str, errors: list[str] = None):
        self.message = message
        self.errors = errors or []
        super().__init__(self.message)


class YamlValidator:
    """Service for validating YAML configurations"""

    # Launch schema
    LAUNCH_SCHEMA = {
        "type": "object",
        "required": ["name", "launch_timestamp", "summary", "location_id"],
        "properties": {
            "name": {"type": "string", "minLength": 1},
            "launch_timestamp": {"type": "string", "format": "date-time"},
            "summary": {"type": "string", "minLength": 1},
            "location_id": {"type": "string", "format": "uuid"},
        },
    }

    # Mission schema
    MISSION_SCHEMA = {
        "type": "object",
        "required": ["name", "launch_id"],
        "properties": {
            "name": {"type": "string", "minLength": 1},
            "launch_id": {"type": "string", "format": "uuid"},
            "active": {"type": "boolean"},
            "sales_open_at": {"type": "string", "format": "date-time"},
            "refund_cutoff_hours": {"type": "integer", "minimum": 0, "maximum": 72},
        },
    }

    # Trip schema
    TRIP_SCHEMA = {
        "type": "object",
        "required": [
            "mission_id",
            "type",
            "check_in_time",
            "boarding_time",
            "departure_time",
        ],
        "properties": {
            "mission_id": {"type": "string", "format": "uuid"},
            "type": {"type": "string", "maxLength": 50},
            "name": {"type": "string", "maxLength": 255},
            "active": {"type": "boolean"},
            "check_in_time": {"type": "string", "format": "date-time"},
            "boarding_time": {"type": "string", "format": "date-time"},
            "departure_time": {"type": "string", "format": "date-time"},
        },
    }

    # Mission schema for multi-document (launch_id or launch_ref)
    MISSION_IN_DOC_SCHEMA = {
        "type": "object",
        "required": ["name"],
        "properties": {
            "name": {"type": "string", "minLength": 1},
            "launch_id": {"type": "string", "format": "uuid"},
            "launch_ref": {"type": "integer", "minimum": 0},
            "active": {"type": "boolean"},
            "sales_open_at": {"type": "string", "format": "date-time"},
            "refund_cutoff_hours": {"type": "integer", "minimum": 0, "maximum": 72},
        },
    }

    # Trip schema for multi-document (mission_id or mission_ref)
    TRIP_IN_DOC_SCHEMA = {
        "type": "object",
        "required": [
            "type",
            "check_in_time",
            "boarding_time",
            "departure_time",
        ],
        "properties": {
            "mission_id": {"type": "string", "format": "uuid"},
            "mission_ref": {"type": "integer", "minimum": 0},
            "type": {"type": "string", "maxLength": 50},
            "name": {"type": "string", "maxLength": 255},
            "active": {"type": "boolean"},
            "booking_mode": {"type": "string", "maxLength": 20},
            "check_in_time": {"type": "string", "format": "date-time"},
            "boarding_time": {"type": "string", "format": "date-time"},
            "departure_time": {"type": "string", "format": "date-time"},
        },
    }

    MULTI_DOC_KEYS = ("launches", "missions", "trips")

    @classmethod
    def validate_yaml_content(
        cls, yaml_content: str, schema_type: str
    ) -> dict[str, Any]:
        """
        Validate YAML content against the specified schema

        Args:
            yaml_content: Raw YAML string
            schema_type: One of 'launch', 'mission', 'trip'

        Returns:
            Parsed and validated YAML data

        Raises:
            YamlValidationError: If validation fails
        """
        try:
            # Parse YAML
            data = yaml.safe_load(yaml_content)
            if not data:
                raise YamlValidationError("YAML file is empty or invalid")

            # Get schema
            schema_map = {
                "launch": cls.LAUNCH_SCHEMA,
                "mission": cls.MISSION_SCHEMA,
                "trip": cls.TRIP_SCHEMA,
            }

            if schema_type not in schema_map:
                raise YamlValidationError(f"Unknown schema type: {schema_type}")

            schema = schema_map[schema_type]

            # Basic validation (we'll use a simple approach for now)
            # In a production system, you'd use jsonschema library
            cls._validate_required_fields(data, schema)
            cls._validate_field_types(data, schema)

            logger.info(f"YAML validation successful for {schema_type}")
            return data

        except yaml.YAMLError as e:
            raise YamlValidationError(f"Invalid YAML format: {str(e)}")
        except Exception as e:
            raise YamlValidationError(f"Validation error: {str(e)}")

    @classmethod
    def _validate_required_fields(
        cls, data: dict[str, Any], schema: dict[str, Any]
    ) -> None:
        """Validate that all required fields are present"""
        required_fields = schema.get("required", [])
        missing_fields = []

        for field in required_fields:
            if field not in data or data[field] is None:
                missing_fields.append(field)

        if missing_fields:
            raise YamlValidationError(
                f"Missing required fields: {', '.join(missing_fields)}"
            )

    @classmethod
    def _validate_field_types(
        cls, data: dict[str, Any], schema: dict[str, Any]
    ) -> None:
        """Basic type validation"""
        properties = schema.get("properties", {})

        for field, value in data.items():
            if field not in properties:
                continue  # Skip unknown fields

            field_schema = properties[field]
            expected_type = field_schema.get("type")

            if expected_type == "string" and not isinstance(value, str):
                raise YamlValidationError(f"Field '{field}' must be a string")
            elif expected_type == "integer" and not isinstance(value, int):
                raise YamlValidationError(f"Field '{field}' must be an integer")
            elif expected_type == "number" and not isinstance(value, int | float):
                raise YamlValidationError(f"Field '{field}' must be a number")
            elif expected_type == "object" and not isinstance(value, dict):
                raise YamlValidationError(f"Field '{field}' must be an object")

    @classmethod
    def validate_multi_document(cls, yaml_content: str) -> dict[str, Any]:
        """
        Validate a multi-entity YAML document.

        Root must be a dict with at least one of: launches (list), missions (list),
        trips (list). Missions may use launch_id (UUID) or launch_ref (0-based index
        into launches in this file). Trips may use mission_id (UUID) or mission_ref
        (0-based index into missions in this file).

        Returns:
            Parsed and validated data dict with keys launches, missions, trips
            (each present only if in the document).

        Raises:
            YamlValidationError: If validation fails.
        """
        try:
            data = yaml.safe_load(yaml_content)
            if not data or not isinstance(data, dict):
                raise YamlValidationError("YAML must be a non-empty object")

            has_any = any(data.get(k) is not None for k in cls.MULTI_DOC_KEYS)
            if not has_any:
                raise YamlValidationError(
                    "Document must contain at least one of: launches, missions, trips"
                )

            result: dict[str, Any] = {}

            if "launches" in data and data["launches"] is not None:
                launches = data["launches"]
                if not isinstance(launches, list):
                    raise YamlValidationError("'launches' must be a list")
                for i, item in enumerate(launches):
                    if not isinstance(item, dict):
                        raise YamlValidationError(f"launches[{i}] must be an object")
                    cls._validate_required_fields(item, cls.LAUNCH_SCHEMA)
                    cls._validate_field_types(item, cls.LAUNCH_SCHEMA)
                result["launches"] = launches

            if "missions" in data and data["missions"] is not None:
                missions = data["missions"]
                if not isinstance(missions, list):
                    raise YamlValidationError("'missions' must be a list")
                n_launches = len(result.get("launches", []))
                for i, item in enumerate(missions):
                    if not isinstance(item, dict):
                        raise YamlValidationError(f"missions[{i}] must be an object")
                    if "launch_id" not in item and "launch_ref" not in item:
                        raise YamlValidationError(
                            f"missions[{i}]: must have launch_id or launch_ref"
                        )
                    if "launch_ref" in item and (
                        item["launch_ref"] < 0 or item["launch_ref"] >= n_launches
                    ):
                        raise YamlValidationError(
                            f"missions[{i}]: launch_ref must be 0..{n_launches - 1}"
                        )
                    cls._validate_required_fields(item, cls.MISSION_IN_DOC_SCHEMA)
                    cls._validate_field_types(item, cls.MISSION_IN_DOC_SCHEMA)
                result["missions"] = missions

            if "trips" in data and data["trips"] is not None:
                trips = data["trips"]
                if not isinstance(trips, list):
                    raise YamlValidationError("'trips' must be a list")
                n_missions = len(result.get("missions", []))
                for i, item in enumerate(trips):
                    if not isinstance(item, dict):
                        raise YamlValidationError(f"trips[{i}] must be an object")
                    if "mission_id" not in item and "mission_ref" not in item:
                        raise YamlValidationError(
                            f"trips[{i}]: must have mission_id or mission_ref"
                        )
                    if "mission_ref" in item and (
                        item["mission_ref"] < 0 or item["mission_ref"] >= n_missions
                    ):
                        raise YamlValidationError(
                            f"trips[{i}]: mission_ref must be 0..{n_missions - 1}"
                        )
                    cls._validate_required_fields(item, cls.TRIP_IN_DOC_SCHEMA)
                    cls._validate_field_types(item, cls.TRIP_IN_DOC_SCHEMA)
                result["trips"] = trips

            logger.info(
                "YAML multi-document validation successful: %s",
                list(result.keys()),
            )
            return result

        except yaml.YAMLError as e:
            raise YamlValidationError(f"Invalid YAML format: {str(e)}")
        except YamlValidationError:
            raise
        except Exception as e:
            raise YamlValidationError(f"Validation error: {str(e)}")
