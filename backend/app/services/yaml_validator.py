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
            "public": {"type": "boolean"},
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
            "active": {"type": "boolean"},
            "check_in_time": {"type": "string", "format": "date-time"},
            "boarding_time": {"type": "string", "format": "date-time"},
            "departure_time": {"type": "string", "format": "date-time"},
        },
    }

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
