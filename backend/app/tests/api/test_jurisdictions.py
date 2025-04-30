from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.core.db import engine
from app.models import JurisdictionCreate, LocationCreate


def test_create_jurisdiction(
    client: TestClient, superuser_token_headers: dict, db: Session
) -> None:
    """Test creating a new jurisdiction."""
    # First, create a location
    location_id = "test-location-api-j1"
    location_in = LocationCreate(
        id=location_id,
        name="Test Location API J1",
        state="Florida",
        slug="test-location-api-j1",
    )
    crud.create_location(session=db, location_in=location_in)

    # Prepare jurisdiction data
    jurisdiction_id = "test-jurisdiction-api-1"
    jurisdiction_name = "Test Jurisdiction API 1"
    jurisdiction_state = "Florida"
    jurisdiction_tax_rate = 0.075

    data = {
        "id": jurisdiction_id,
        "name": jurisdiction_name,
        "state": jurisdiction_state,
        "sales_tax_rate": jurisdiction_tax_rate,
        "location_id": location_id,
        "slug": "test-jurisdiction-api-1",
    }

    # Call API
    response = client.post(
        f"{settings.API_V1_STR}/jurisdictions/",
        headers=superuser_token_headers,
        json=data,
    )

    # Check response
    assert response.status_code == 201
    content = response.json()
    assert content["name"] == jurisdiction_name
    assert content["state"] == jurisdiction_state
    assert content["sales_tax_rate"] == jurisdiction_tax_rate
    assert content["location_id"] == location_id
    assert content["id"] == jurisdiction_id
    assert "slug" in content
    assert content["slug"] == "test-jurisdiction-api-1"
    assert "created_at" in content
    assert "updated_at" in content


def test_read_jurisdictions(
    client: TestClient, normal_user_token_headers: dict, db: Session
) -> None:
    """Test retrieving jurisdictions."""
    # Create a location
    location_id = "read-test-location-api-j1"
    location_in = LocationCreate(
        id=location_id,
        name="Read Test Location API J1",
        state="Test State",
        slug="read-test-location-api-j1",
    )
    crud.create_location(session=db, location_in=location_in)

    # Create a few jurisdictions
    jurisdiction1 = JurisdictionCreate(
        id="port-api-1",
        name="Port Canaveral API 1",
        state="Florida",
        sales_tax_rate=0.07,
        location_id=location_id,
        slug="port-canaveral-api-1",
    )
    jurisdiction2 = JurisdictionCreate(
        id="spi-api-1",
        name="South Padre Island API 1",
        state="Texas",
        sales_tax_rate=0.0825,
        location_id=location_id,
        slug="south-padre-island-api-1",
    )

    crud.create_jurisdiction(session=db, jurisdiction_in=jurisdiction1)
    crud.create_jurisdiction(session=db, jurisdiction_in=jurisdiction2)

    # Call API
    response = client.get(
        f"{settings.API_V1_STR}/jurisdictions/",
        headers=normal_user_token_headers,
    )

    # Check response
    assert response.status_code == 200
    content = response.json()
    assert "data" in content
    assert "count" in content
    assert content["count"] >= 2  # At least our 2 jurisdictions

    # Check that our created jurisdictions are in the list
    jurisdiction_ids = [jurisdiction["id"] for jurisdiction in content["data"]]
    assert "port-api-1" in jurisdiction_ids
    assert "spi-api-1" in jurisdiction_ids


def test_read_jurisdictions_by_location(
    client: TestClient, normal_user_token_headers: dict, db: Session
) -> None:
    """Test retrieving jurisdictions filtered by location."""
    # Create two locations
    location1_id = "filter-location-api-1"
    location2_id = "filter-location-api-2"

    location1_in = LocationCreate(
        id=location1_id,
        name="Filter Location API 1",
        state="Florida",
        slug="filter-location-api-1",
    )
    location2_in = LocationCreate(
        id=location2_id,
        name="Filter Location API 2",
        state="Texas",
        slug="filter-location-api-2",
    )

    crud.create_location(session=db, location_in=location1_in)
    crud.create_location(session=db, location_in=location2_in)

    # Create jurisdictions for each location
    jurisdiction1 = JurisdictionCreate(
        id="j-api-loc1-1",
        name="Jurisdiction API Loc1 1",
        state="Florida",
        sales_tax_rate=0.07,
        location_id=location1_id,
        slug="j-api-loc1-1",
    )
    jurisdiction2 = JurisdictionCreate(
        id="j-api-loc2-1",
        name="Jurisdiction API Loc2 1",
        state="Texas",
        sales_tax_rate=0.0825,
        location_id=location2_id,
        slug="j-api-loc2-1",
    )

    crud.create_jurisdiction(session=db, jurisdiction_in=jurisdiction1)
    crud.create_jurisdiction(session=db, jurisdiction_in=jurisdiction2)

    # Call API with location filter
    response = client.get(
        f"{settings.API_V1_STR}/jurisdictions/?location_id={location1_id}",
        headers=normal_user_token_headers,
    )

    # Check response
    assert response.status_code == 200
    content = response.json()
    assert "data" in content
    assert "count" in content

    # Should find only the jurisdiction for location 1
    jurisdiction_ids = [jurisdiction["id"] for jurisdiction in content["data"]]
    assert "j-api-loc1-1" in jurisdiction_ids
    assert "j-api-loc2-1" not in jurisdiction_ids


def test_read_jurisdiction(
    client: TestClient, normal_user_token_headers: dict, db: Session
) -> None:
    """Test retrieving a specific jurisdiction."""
    # Create a location
    location_id = "get-test-location-api-j1"
    location_in = LocationCreate(
        id=location_id,
        name="Get Test Location API J1",
        state="Test State",
        slug="get-test-location-api-j1",
    )
    crud.create_location(session=db, location_in=location_in)

    # Create a jurisdiction
    jurisdiction = JurisdictionCreate(
        id="test-jurisdiction-api-2",
        name="Test Jurisdiction API 2",
        state="Test State",
        sales_tax_rate=0.06,
        location_id=location_id,
        slug="test-jurisdiction-api-2",
    )
    db_jurisdiction = crud.create_jurisdiction(session=db, jurisdiction_in=jurisdiction)

    # Call API
    response = client.get(
        f"{settings.API_V1_STR}/jurisdictions/{db_jurisdiction.id}",
        headers=normal_user_token_headers,
    )

    # Check response
    assert response.status_code == 200
    content = response.json()
    assert content["id"] == db_jurisdiction.id
    assert content["name"] == db_jurisdiction.name
    assert content["state"] == db_jurisdiction.state
    assert content["sales_tax_rate"] == db_jurisdiction.sales_tax_rate
    assert content["location_id"] == db_jurisdiction.location_id
    assert content["slug"] == db_jurisdiction.slug


def test_update_jurisdiction(
    client: TestClient, superuser_token_headers: dict, db: Session
) -> None:
    """Test updating a jurisdiction."""
    # Create a location
    location_id = "update-test-location-api-j1"
    location_in = LocationCreate(
        id=location_id,
        name="Update Test Location API J1",
        state="Test State",
        slug="update-test-location-api-j1",
    )
    crud.create_location(session=db, location_in=location_in)

    # Create a jurisdiction
    jurisdiction = JurisdictionCreate(
        id="update-test-jurisdiction-api-1",
        name="Update Test Jurisdiction API 1",
        state="Test State",
        sales_tax_rate=0.06,
        location_id=location_id,
        slug="update-test-jurisdiction-api-1",
    )
    db_jurisdiction = crud.create_jurisdiction(session=db, jurisdiction_in=jurisdiction)

    # Update data
    data = {
        "name": "Updated Name API J1",
        "state": "Updated State",
        "sales_tax_rate": 0.07,
    }

    # Call API
    response = client.put(
        f"{settings.API_V1_STR}/jurisdictions/{db_jurisdiction.id}",
        headers=superuser_token_headers,
        json=data,
    )

    # Check response
    assert response.status_code == 200
    content = response.json()
    assert content["id"] == db_jurisdiction.id
    assert content["name"] == "Updated Name API J1"
    assert content["state"] == "Updated State"
    assert content["sales_tax_rate"] == 0.07
    assert content["slug"] == "updated-name-api-j1"  # Slug should be auto-updated
    assert content["location_id"] == location_id  # location_id should not change


def test_delete_jurisdiction(
    client: TestClient, superuser_token_headers: dict, db: Session
) -> None:
    """Test deleting a jurisdiction."""
    # Create a location
    location_id = "delete-test-location-api-j1"
    location_in = LocationCreate(
        id=location_id,
        name="Delete Test Location API J1",
        state="Test State",
        slug="delete-test-location-api-j1",
    )
    crud.create_location(session=db, location_in=location_in)

    # Create a jurisdiction
    jurisdiction = JurisdictionCreate(
        id="delete-test-jurisdiction-api-1",
        name="Delete Test Jurisdiction API 1",
        state="Test State",
        sales_tax_rate=0.06,
        location_id=location_id,
        slug="delete-test-jurisdiction-api-1",
    )
    db_jurisdiction = crud.create_jurisdiction(session=db, jurisdiction_in=jurisdiction)

    # Call API
    response = client.delete(
        f"{settings.API_V1_STR}/jurisdictions/{db_jurisdiction.id}",
        headers=superuser_token_headers,
    )

    # Check response
    assert response.status_code == 204

    # Clear the session to ensure we get fresh data
    db.close()

    # Open a new session and verify deletion
    with Session(engine) as new_session:
        db_jurisdiction = crud.get_jurisdiction(
            session=new_session, jurisdiction_id=jurisdiction.id
        )
        assert db_jurisdiction is None
