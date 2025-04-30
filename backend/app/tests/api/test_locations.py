from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.core.db import engine
from app.models import LocationCreate


def test_create_location(client: TestClient, superuser_token_headers: dict) -> None:
    """Test creating a new location."""
    # Prepare data
    location_id = "test-location-api-1"
    location_name = "Test Location API 1"
    location_state = "Florida"

    data = {
        "id": location_id,
        "name": location_name,
        "state": location_state,
        "slug": "test-location-api-1",
    }

    # Call API
    response = client.post(
        f"{settings.API_V1_STR}/locations/",
        headers=superuser_token_headers,
        json=data,
    )

    # Check response
    assert response.status_code == 201
    content = response.json()
    assert content["name"] == location_name
    assert content["state"] == location_state
    assert content["id"] == location_id
    assert "slug" in content
    assert content["slug"] == "test-location-api-1"
    assert "created_at" in content
    assert "updated_at" in content


def test_read_locations(
    client: TestClient, normal_user_token_headers: dict, test_db: Session
) -> None:
    """Test retrieving locations."""
    # Create a few locations
    location1 = LocationCreate(
        id="cape-api-1",
        name="Cape Canaveral API 1",
        state="Florida",
        slug="cape-canaveral-api-1",
    )
    location2 = LocationCreate(
        id="starbase-api-1", name="Starbase API 1", state="Texas", slug="starbase-api-1"
    )

    crud.create_location(session=test_db, location_in=location1)
    crud.create_location(session=test_db, location_in=location2)

    # Call API
    response = client.get(
        f"{settings.API_V1_STR}/locations/",
        headers=normal_user_token_headers,
    )

    # Check response
    assert response.status_code == 200
    content = response.json()
    assert "data" in content
    assert "count" in content
    assert content["count"] >= 2  # At least our 2 locations

    # Check that our created locations are in the list
    location_ids = [location["id"] for location in content["data"]]
    assert "cape-api-1" in location_ids
    assert "starbase-api-1" in location_ids


def test_read_location(
    client: TestClient, normal_user_token_headers: dict, test_db: Session
) -> None:
    """Test retrieving a specific location."""
    # Create a location
    location = LocationCreate(
        id="test-location-api-2",
        name="Test Location API 2",
        state="Test State",
        slug="test-location-api-2",
    )
    db_location = crud.create_location(session=test_db, location_in=location)

    # Call API
    response = client.get(
        f"{settings.API_V1_STR}/locations/{db_location.id}",
        headers=normal_user_token_headers,
    )

    # Check response
    assert response.status_code == 200
    content = response.json()
    assert content["id"] == db_location.id
    assert content["name"] == db_location.name
    assert content["state"] == db_location.state
    assert content["slug"] == db_location.slug


def test_update_location(
    client: TestClient, superuser_token_headers: dict, test_db: Session
) -> None:
    """Test updating a location."""
    # Create a location
    location = LocationCreate(
        id="update-test-api-1",
        name="Update Test API 1",
        state="Test State",
        slug="update-test-api-1",
    )
    db_location = crud.create_location(session=test_db, location_in=location)

    # Update data
    data = {"name": "Updated Name API 1", "state": "Updated State"}

    # Call API
    response = client.put(
        f"{settings.API_V1_STR}/locations/{db_location.id}",
        headers=superuser_token_headers,
        json=data,
    )

    # Check response
    assert response.status_code == 200
    content = response.json()
    assert content["id"] == db_location.id
    assert content["name"] == "Updated Name API 1"
    assert content["state"] == "Updated State"
    assert content["slug"] == "updated-name-api-1"  # Slug should be auto-updated


def test_delete_location(
    client: TestClient, superuser_token_headers: dict, test_db: Session
) -> None:
    """Test deleting a location."""
    # Create a location
    location = LocationCreate(
        id="delete-test-api-1",
        name="Delete Test API 1",
        state="Test State",
        slug="delete-test-api-1",
    )
    db_location = crud.create_location(session=test_db, location_in=location)

    # Call API
    response = client.delete(
        f"{settings.API_V1_STR}/locations/{db_location.id}",
        headers=superuser_token_headers,
    )

    # Check response
    assert response.status_code == 204

    # Clear the session to ensure we get fresh data
    test_db.close()

    # Open a new session and verify deletion
    with Session(engine) as new_session:
        db_location = crud.get_location(session=new_session, location_id=location.id)
        assert db_location is None
