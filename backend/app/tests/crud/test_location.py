from sqlmodel import Session

from app import crud
from app.models import LocationCreate, LocationUpdate


def test_create_location(test_db: Session) -> None:
    """Test creating a location."""
    location_id = "test-location-1"
    location_name = "Test Location 1"
    location_state = "Florida"

    location_in = LocationCreate(
        id=location_id,
        name=location_name,
        state=location_state,
        slug="test-location-1",
    )

    location = crud.create_location(session=test_db, location_in=location_in)

    assert location.id == location_id
    assert location.name == location_name
    assert location.state == location_state
    assert location.slug == "test-location-1"
    assert location.created_at is not None
    assert location.updated_at is not None


def test_get_location(test_db: Session) -> None:
    """Test retrieving a location by ID."""
    # Create a location
    location_in = LocationCreate(
        id="get-test-1",
        name="Get Test 1",
        state="Test State",
        slug="get-test-1",
    )
    db_location = crud.create_location(session=test_db, location_in=location_in)

    # Retrieve the location
    location = crud.get_location(session=test_db, location_id=db_location.id)

    assert location is not None
    assert location.id == db_location.id
    assert location.name == db_location.name
    assert location.state == db_location.state
    assert location.slug == db_location.slug


def test_get_location_by_slug(test_db: Session) -> None:
    """Test retrieving a location by slug."""
    # Create a location
    location_in = LocationCreate(
        id="slug-test-1",
        name="Slug Test 1",
        state="Test State",
        slug="slug-test-1",
    )
    db_location = crud.create_location(session=test_db, location_in=location_in)

    # Retrieve the location by slug
    location = crud.get_location_by_slug(session=test_db, slug=db_location.slug)

    assert location is not None
    assert location.id == db_location.id
    assert location.name == db_location.name
    assert location.state == db_location.state


def test_get_locations(test_db: Session) -> None:
    """Test retrieving a list of locations."""
    # Create a few locations
    location1 = LocationCreate(
        id="cape-test",
        name="Cape Canaveral Test",
        state="Florida",
        slug="cape-canaveral-test",
    )
    location2 = LocationCreate(
        id="starbase-test", name="Starbase Test", state="Texas", slug="starbase-test"
    )

    crud.create_location(session=test_db, location_in=location1)
    crud.create_location(session=test_db, location_in=location2)

    # Get locations
    locations = crud.get_locations(session=test_db)

    # We should have at least the two locations we just created
    assert len(locations) >= 2

    # Check that our locations are in the list
    location_ids = [loc.id for loc in locations]
    assert "cape-test" in location_ids
    assert "starbase-test" in location_ids


def test_update_location(test_db: Session) -> None:
    """Test updating a location."""
    # Create a location
    location_in = LocationCreate(
        id="update-test-1",
        name="Update Test 1",
        state="Test State",
        slug="update-test-1",
    )
    db_location = crud.create_location(session=test_db, location_in=location_in)

    # Update data
    update_in = LocationUpdate(
        name="Updated Name 1",
        state="Updated State",
    )

    # Update the location
    updated_location = crud.update_location(
        session=test_db, db_obj=db_location, obj_in=update_in
    )

    assert updated_location.id == db_location.id
    assert updated_location.name == "Updated Name 1"
    assert updated_location.state == "Updated State"
    assert updated_location.slug == "updated-name-1"  # Slug should be auto-updated


def test_delete_location(test_db: Session) -> None:
    """Test deleting a location."""
    # Create a location
    location_in = LocationCreate(
        id="delete-test-1",
        name="Delete Test 1",
        state="Test State",
        slug="delete-test-1",
    )
    db_location = crud.create_location(session=test_db, location_in=location_in)

    # Delete the location
    crud.delete_location(session=test_db, db_obj=db_location)

    # Verify deletion
    location = crud.get_location(session=test_db, location_id=db_location.id)
    assert location is None
