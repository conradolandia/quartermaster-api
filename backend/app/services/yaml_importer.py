import logging
import uuid
from datetime import datetime

from sqlmodel import Session

from app.models import Launch, LaunchCreate, Mission, MissionCreate, Trip, TripCreate
from app.services.yaml_validator import YamlValidator

logger = logging.getLogger(__name__)


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


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
                launch_timestamp=_parse_dt(data["launch_timestamp"]),
                summary=data["summary"],
                location_id=uuid.UUID(data["location_id"])
                if isinstance(data["location_id"], str)
                else data["location_id"],
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
                launch_id=uuid.UUID(data["launch_id"])
                if isinstance(data["launch_id"], str)
                else data["launch_id"],
                active=data.get("active", True),
                sales_open_at=_parse_dt(data.get("sales_open_at")),
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
                mission_id=uuid.UUID(data["mission_id"])
                if isinstance(data["mission_id"], str)
                else data["mission_id"],
                name=data.get("name"),
                type=data["type"],
                active=data.get("active", True),
                booking_mode=data.get("booking_mode", "private"),
                check_in_time=_parse_dt(data["check_in_time"]),
                boarding_time=_parse_dt(data["boarding_time"]),
                departure_time=_parse_dt(data["departure_time"]),
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

    def import_document(
        self, yaml_content: str
    ) -> tuple[list[Launch], list[Mission], list[Trip]]:
        """
        Import a multi-entity YAML document.

        Root must have at least one of: launches (list), missions (list), trips (list).
        Creation order: launches, then missions (may use launch_ref index), then trips
        (may use mission_ref index). Returns (created_launches, created_missions,
        created_trips).

        Raises:
            YamlValidationError: If validation fails.
        """
        data = YamlValidator.validate_multi_document(yaml_content)
        created_launches: list[Launch] = []
        created_missions: list[Mission] = []
        created_trips: list[Trip] = []

        try:
            for item in data.get("launches") or []:
                launch_data = LaunchCreate(
                    name=item["name"],
                    launch_timestamp=_parse_dt(item["launch_timestamp"]),
                    summary=item["summary"],
                    location_id=uuid.UUID(item["location_id"])
                    if isinstance(item["location_id"], str)
                    else item["location_id"],
                )
                launch = Launch.model_validate(launch_data)
                self.session.add(launch)
                self.session.flush()
                self.session.refresh(launch)
                created_launches.append(launch)

            for item in data.get("missions") or []:
                launch_id = item.get("launch_id")
                if launch_id is None:
                    launch_id = created_launches[item["launch_ref"]].id
                elif isinstance(launch_id, str):
                    launch_id = uuid.UUID(launch_id)
                mission_data = MissionCreate(
                    name=item["name"],
                    launch_id=launch_id,
                    active=item.get("active", True),
                    sales_open_at=_parse_dt(item.get("sales_open_at")),
                    refund_cutoff_hours=item.get("refund_cutoff_hours", 12),
                )
                mission = Mission.model_validate(mission_data)
                self.session.add(mission)
                self.session.flush()
                self.session.refresh(mission)
                created_missions.append(mission)

            for item in data.get("trips") or []:
                mission_id = item.get("mission_id")
                if mission_id is None:
                    mission_id = created_missions[item["mission_ref"]].id
                elif isinstance(mission_id, str):
                    mission_id = uuid.UUID(mission_id)
                elif isinstance(mission_id, str):
                    mission_id = uuid.UUID(mission_id)
                trip_data = TripCreate(
                    mission_id=mission_id,
                    name=item.get("name"),
                    type=item["type"],
                    active=item.get("active", True),
                    booking_mode=item.get("booking_mode", "private"),
                    check_in_time=_parse_dt(item["check_in_time"]),
                    boarding_time=_parse_dt(item["boarding_time"]),
                    departure_time=_parse_dt(item["departure_time"]),
                )
                trip = Trip.model_validate(trip_data)
                self.session.add(trip)
                self.session.flush()
                self.session.refresh(trip)
                created_trips.append(trip)

            self.session.commit()
            logger.info(
                "Imported document: %d launches, %d missions, %d trips",
                len(created_launches),
                len(created_missions),
                len(created_trips),
            )
            return (created_launches, created_missions, created_trips)

        except Exception as e:
            self.session.rollback()
            logger.error(f"Failed to import document: {str(e)}")
            raise
