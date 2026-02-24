"""
Tests for app.crud.launches module.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlmodel import Session

from app.crud.launches import (
    create_launch,
    delete_launch,
    get_launch,
    get_launches,
    get_launches_by_location,
    get_launches_count,
    update_launch,
)
from app.models import (
    Launch,
    LaunchCreate,
    LaunchUpdate,
    Location,
    Mission,
)


class TestGetLaunch:
    """Tests for get_launch function."""

    def test_returns_launch_when_exists(
        self,
        db: Session,
        test_launch: Launch,
    ) -> None:
        result = get_launch(session=db, launch_id=test_launch.id)
        assert result is not None
        assert result.id == test_launch.id
        assert result.name == test_launch.name

    def test_returns_none_when_not_exists(
        self,
        db: Session,
    ) -> None:
        result = get_launch(session=db, launch_id=uuid.uuid4())
        assert result is None


class TestGetLaunches:
    """Tests for get_launches function."""

    def test_returns_launches(
        self,
        db: Session,
        test_launch: Launch,
    ) -> None:
        result = get_launches(session=db)
        assert len(result) >= 1
        launch_ids = [launch.id for launch in result]
        assert test_launch.id in launch_ids


class TestGetLaunchesCount:
    """Tests for get_launches_count function."""

    def test_returns_count(
        self,
        db: Session,
        test_launch: Launch,
    ) -> None:
        result = get_launches_count(session=db)
        assert result >= 1


class TestGetLaunchesByLocation:
    """Tests for get_launches_by_location function."""

    def test_returns_launches_for_location(
        self,
        db: Session,
        test_location: Location,
        test_launch: Launch,
    ) -> None:
        result = get_launches_by_location(session=db, location_id=test_location.id)
        assert len(result) == 1
        assert result[0].id == test_launch.id

    def test_returns_empty_for_unknown_location(
        self,
        db: Session,
    ) -> None:
        result = get_launches_by_location(session=db, location_id=uuid.uuid4())
        assert result == []


class TestCreateLaunch:
    """Tests for create_launch function."""

    def test_creates_launch(
        self,
        db: Session,
        test_location: Location,
    ) -> None:
        future_date = datetime.now(timezone.utc) + timedelta(days=45)
        launch_in = LaunchCreate(
            name="New Launch",
            launch_timestamp=future_date,
            summary="A new rocket launch",
            location_id=test_location.id,
        )

        result = create_launch(session=db, launch_in=launch_in)

        assert result.id is not None
        assert result.name == "New Launch"
        assert result.location_id == test_location.id


class TestUpdateLaunch:
    """Tests for update_launch function."""

    def test_updates_launch_name(
        self,
        db: Session,
        test_launch: Launch,
    ) -> None:
        update_data = LaunchUpdate(name="Updated Launch Name")
        result = update_launch(session=db, db_obj=test_launch, obj_in=update_data)

        assert result.name == "Updated Launch Name"

    def test_updates_launch_summary(
        self,
        db: Session,
        test_launch: Launch,
    ) -> None:
        update_data = LaunchUpdate(summary="Updated summary text")
        result = update_launch(session=db, db_obj=test_launch, obj_in=update_data)

        assert result.summary == "Updated summary text"


class TestDeleteLaunch:
    """Tests for delete_launch function."""

    def test_deletes_launch_without_missions(
        self,
        db: Session,
        test_location: Location,
    ) -> None:
        future_date = datetime.now(timezone.utc) + timedelta(days=60)
        launch = Launch(
            name="To Delete",
            launch_timestamp=future_date,
            summary="Will be deleted",
            location_id=test_location.id,
        )
        db.add(launch)
        db.commit()
        db.refresh(launch)
        launch_id = launch.id

        delete_launch(session=db, db_obj=launch)

        deleted = get_launch(session=db, launch_id=launch_id)
        assert deleted is None

    def test_fails_to_delete_launch_with_missions(
        self,
        db: Session,
        test_launch: Launch,
        test_mission: Mission,
    ) -> None:
        with pytest.raises(ValueError) as exc_info:
            delete_launch(session=db, db_obj=test_launch)

        assert "Cannot delete this launch" in str(exc_info.value)
