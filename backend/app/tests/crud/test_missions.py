"""
Tests for app.crud.missions module.
"""

import uuid

import pytest
from sqlmodel import Session

from app.crud.missions import (
    create_mission,
    delete_mission,
    get_active_missions,
    get_mission,
    get_missions,
    get_missions_by_launch,
    get_missions_count,
    update_mission,
)
from app.models import (
    Launch,
    Mission,
    MissionCreate,
    MissionUpdate,
    Trip,
)


class TestGetMission:
    """Tests for get_mission function."""

    def test_returns_mission_when_exists(
        self,
        db: Session,
        test_mission: Mission,
    ) -> None:
        result = get_mission(session=db, mission_id=test_mission.id)
        assert result is not None
        assert result.id == test_mission.id
        assert result.name == test_mission.name

    def test_returns_none_when_not_exists(
        self,
        db: Session,
    ) -> None:
        result = get_mission(session=db, mission_id=uuid.uuid4())
        assert result is None


class TestGetMissions:
    """Tests for get_missions function."""

    def test_returns_missions(
        self,
        db: Session,
        test_mission: Mission,
    ) -> None:
        result = get_missions(session=db)
        assert len(result) >= 1
        mission_ids = [m.id for m in result]
        assert test_mission.id in mission_ids


class TestGetMissionsCount:
    """Tests for get_missions_count function."""

    def test_returns_count(
        self,
        db: Session,
        test_mission: Mission,
    ) -> None:
        result = get_missions_count(session=db)
        assert result >= 1


class TestGetMissionsByLaunch:
    """Tests for get_missions_by_launch function."""

    def test_returns_missions_for_launch(
        self,
        db: Session,
        test_launch: Launch,
        test_mission: Mission,
    ) -> None:
        result = get_missions_by_launch(session=db, launch_id=test_launch.id)
        assert len(result) == 1
        assert result[0].id == test_mission.id

    def test_returns_empty_for_unknown_launch(
        self,
        db: Session,
    ) -> None:
        result = get_missions_by_launch(session=db, launch_id=uuid.uuid4())
        assert result == []


class TestGetActiveMissions:
    """Tests for get_active_missions function."""

    def test_returns_active_missions(
        self,
        db: Session,
        test_mission: Mission,
    ) -> None:
        result = get_active_missions(session=db)
        assert len(result) >= 1
        assert all(m.active for m in result)


class TestCreateMission:
    """Tests for create_mission function."""

    def test_creates_mission(
        self,
        db: Session,
        test_launch: Launch,
    ) -> None:
        mission_in = MissionCreate(
            name="New Mission",
            launch_id=test_launch.id,
            active=True,
            refund_cutoff_hours=24,
        )

        result = create_mission(session=db, mission_in=mission_in)

        assert result.id is not None
        assert result.name == "New Mission"
        assert result.launch_id == test_launch.id


class TestUpdateMission:
    """Tests for update_mission function."""

    def test_updates_mission_name(
        self,
        db: Session,
        test_mission: Mission,
    ) -> None:
        update_data = MissionUpdate(name="Updated Mission Name")
        result = update_mission(session=db, db_obj=test_mission, obj_in=update_data)

        assert result.name == "Updated Mission Name"

    def test_updates_mission_active(
        self,
        db: Session,
        test_mission: Mission,
    ) -> None:
        update_data = MissionUpdate(active=False)
        result = update_mission(session=db, db_obj=test_mission, obj_in=update_data)

        assert result.active is False


class TestDeleteMission:
    """Tests for delete_mission function."""

    def test_deletes_mission_without_trips(
        self,
        db: Session,
        test_launch: Launch,
    ) -> None:
        mission = Mission(
            name="To Delete",
            launch_id=test_launch.id,
            active=True,
        )
        db.add(mission)
        db.commit()
        db.refresh(mission)
        mission_id = mission.id

        delete_mission(session=db, db_obj=mission)

        deleted = get_mission(session=db, mission_id=mission_id)
        assert deleted is None

    def test_fails_to_delete_mission_with_trips(
        self,
        db: Session,
        test_mission: Mission,
        test_trip: Trip,
    ) -> None:
        with pytest.raises(ValueError) as exc_info:
            delete_mission(session=db, db_obj=test_mission)

        assert "Cannot delete this mission" in str(exc_info.value)
