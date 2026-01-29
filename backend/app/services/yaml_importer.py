import logging
from datetime import datetime

from sqlmodel import Session

from app.models import Launch, LaunchCreate, Mission, MissionCreate, Trip, TripCreate
from app.services.yaml_validator import YamlValidator

logger = logging.getLogger(__name__)


class YamlImporter:
    """Service for importing YAML configurations into the database"""

    def __init__(self, session: Session):
        self.session = session

    def import_launch(self, yaml_content: str) -> Launch:
        """
        Import a launch from YAML content

        Args:
            yaml_content: Raw YAML string containing launch data

        Returns:
            Created Launch object

        Raises:
            YamlValidationError: If YAML validation fails
        """
        try:
            # Validate YAML
            data = YamlValidator.validate_yaml_content(yaml_content, "launch")

            # Convert to LaunchCreate
            launch_data = LaunchCreate(
                name=data["name"],
                launch_timestamp=datetime.fromisoformat(
                    data["launch_timestamp"].replace("Z", "+00:00")
                ),
                summary=data["summary"],
                location_id=data["location_id"],
            )

            # Create launch in database
            launch = Launch.model_validate(launch_data)
            self.session.add(launch)
            self.session.commit()
            self.session.refresh(launch)

            logger.info(f"Successfully imported launch: {launch.name}")
            return launch

        except Exception as e:
            self.session.rollback()
            logger.error(f"Failed to import launch: {str(e)}")
            raise

    def import_mission(self, yaml_content: str) -> Mission:
        """
        Import a mission from YAML content

        Args:
            yaml_content: Raw YAML string containing mission data

        Returns:
            Created Mission object

        Raises:
            YamlValidationError: If YAML validation fails
        """
        try:
            # Validate YAML
            data = YamlValidator.validate_yaml_content(yaml_content, "mission")

            # Convert to MissionCreate
            mission_data = MissionCreate(
                name=data["name"],
                launch_id=data["launch_id"],
                active=data.get("active", True),
                booking_mode=data.get("booking_mode", "private"),
                sales_open_at=datetime.fromisoformat(
                    data["sales_open_at"].replace("Z", "+00:00")
                )
                if data.get("sales_open_at")
                else None,
                refund_cutoff_hours=data.get("refund_cutoff_hours", 12),
            )

            # Create mission in database
            mission = Mission.model_validate(mission_data)
            self.session.add(mission)
            self.session.commit()
            self.session.refresh(mission)

            logger.info(f"Successfully imported mission: {mission.name}")
            return mission

        except Exception as e:
            self.session.rollback()
            logger.error(f"Failed to import mission: {str(e)}")
            raise

    def import_trip(self, yaml_content: str) -> Trip:
        """
        Import a trip from YAML content

        Args:
            yaml_content: Raw YAML string containing trip data

        Returns:
            Created Trip object

        Raises:
            YamlValidationError: If YAML validation fails
        """
        try:
            # Validate YAML
            data = YamlValidator.validate_yaml_content(yaml_content, "trip")

            # Convert to TripCreate
            trip_data = TripCreate(
                mission_id=data["mission_id"],
                name=data.get("name"),
                type=data["type"],
                active=data.get("active", True),
                check_in_time=datetime.fromisoformat(
                    data["check_in_time"].replace("Z", "+00:00")
                ),
                boarding_time=datetime.fromisoformat(
                    data["boarding_time"].replace("Z", "+00:00")
                ),
                departure_time=datetime.fromisoformat(
                    data["departure_time"].replace("Z", "+00:00")
                ),
            )

            # Create trip in database
            trip = Trip.model_validate(trip_data)
            self.session.add(trip)
            self.session.commit()
            self.session.refresh(trip)

            logger.info(f"Successfully imported trip: {trip.id}")
            return trip

        except Exception as e:
            self.session.rollback()
            logger.error(f"Failed to import trip: {str(e)}")
            raise
