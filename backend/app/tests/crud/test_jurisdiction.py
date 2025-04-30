from sqlmodel import Session

from app import crud
from app.models import JurisdictionCreate, JurisdictionUpdate, LocationCreate


def test_create_jurisdiction(db: Session) -> None:
    """Test creating a jurisdiction."""
    # First, create a location
    location_id = "test-location-j1"
    location_in = LocationCreate(
        id=location_id,
        name="Test Location J1",
        state="Florida",
        slug="test-location-j1",
    )
    crud.create_location(session=db, location_in=location_in)

    # Now create a jurisdiction
    jurisdiction_id = "test-jurisdiction-1"
    jurisdiction_name = "Test Jurisdiction 1"
    jurisdiction_state = "Florida"
    jurisdiction_tax_rate = 0.075

    jurisdiction_in = JurisdictionCreate(
        id=jurisdiction_id,
        name=jurisdiction_name,
        state=jurisdiction_state,
        sales_tax_rate=jurisdiction_tax_rate,
        location_id=location_id,
        slug="test-jurisdiction-1",
    )

    jurisdiction = crud.create_jurisdiction(session=db, jurisdiction_in=jurisdiction_in)

    assert jurisdiction.id == jurisdiction_id
    assert jurisdiction.name == jurisdiction_name
    assert jurisdiction.state == jurisdiction_state
    assert jurisdiction.sales_tax_rate == jurisdiction_tax_rate
    assert jurisdiction.location_id == location_id
    assert jurisdiction.slug == "test-jurisdiction-1"
    assert jurisdiction.created_at is not None
    assert jurisdiction.updated_at is not None


def test_get_jurisdiction(db: Session) -> None:
    """Test retrieving a jurisdiction by ID."""
    # Create a location
    location_id = "get-test-location-j1"
    location_in = LocationCreate(
        id=location_id,
        name="Get Test Location J1",
        state="Test State",
        slug="get-test-location-j1",
    )
    crud.create_location(session=db, location_in=location_in)

    # Create a jurisdiction
    jurisdiction_in = JurisdictionCreate(
        id="get-test-j1",
        name="Get Test J1",
        state="Test State",
        sales_tax_rate=0.06,
        location_id=location_id,
        slug="get-test-j1",
    )
    db_jurisdiction = crud.create_jurisdiction(
        session=db, jurisdiction_in=jurisdiction_in
    )

    # Retrieve the jurisdiction
    jurisdiction = crud.get_jurisdiction(session=db, jurisdiction_id=db_jurisdiction.id)

    assert jurisdiction is not None
    assert jurisdiction.id == db_jurisdiction.id
    assert jurisdiction.name == db_jurisdiction.name
    assert jurisdiction.state == db_jurisdiction.state
    assert jurisdiction.slug == db_jurisdiction.slug
    assert jurisdiction.sales_tax_rate == db_jurisdiction.sales_tax_rate
    assert jurisdiction.location_id == db_jurisdiction.location_id


def test_get_jurisdiction_by_slug(db: Session) -> None:
    """Test retrieving a jurisdiction by slug."""
    # Create a location
    location_id = "slug-test-location-j1"
    location_in = LocationCreate(
        id=location_id,
        name="Slug Test Location J1",
        state="Test State",
        slug="slug-test-location-j1",
    )
    crud.create_location(session=db, location_in=location_in)

    # Create a jurisdiction
    jurisdiction_in = JurisdictionCreate(
        id="slug-test-j1",
        name="Slug Test J1",
        state="Test State",
        sales_tax_rate=0.07,
        location_id=location_id,
        slug="slug-test-j1",
    )
    db_jurisdiction = crud.create_jurisdiction(
        session=db, jurisdiction_in=jurisdiction_in
    )

    # Retrieve the jurisdiction by slug
    jurisdiction = crud.get_jurisdiction_by_slug(session=db, slug=db_jurisdiction.slug)

    assert jurisdiction is not None
    assert jurisdiction.id == db_jurisdiction.id
    assert jurisdiction.name == db_jurisdiction.name
    assert jurisdiction.state == db_jurisdiction.state
    assert jurisdiction.sales_tax_rate == db_jurisdiction.sales_tax_rate
    assert jurisdiction.location_id == db_jurisdiction.location_id


def test_get_jurisdictions(db: Session) -> None:
    """Test retrieving a list of jurisdictions."""
    # Create a location
    location_id = "list-test-location-j1"
    location_in = LocationCreate(
        id=location_id,
        name="List Test Location J1",
        state="Test State",
        slug="list-test-location-j1",
    )
    crud.create_location(session=db, location_in=location_in)

    # Create a few jurisdictions
    jurisdiction1 = JurisdictionCreate(
        id="port-test",
        name="Port Canaveral Test",
        state="Florida",
        sales_tax_rate=0.07,
        location_id=location_id,
        slug="port-canaveral-test",
    )
    jurisdiction2 = JurisdictionCreate(
        id="spi-test",
        name="South Padre Island Test",
        state="Texas",
        sales_tax_rate=0.0825,
        location_id=location_id,
        slug="south-padre-island-test",
    )

    crud.create_jurisdiction(session=db, jurisdiction_in=jurisdiction1)
    crud.create_jurisdiction(session=db, jurisdiction_in=jurisdiction2)

    # Get jurisdictions
    jurisdictions = crud.get_jurisdictions(session=db)

    # We should have at least the two jurisdictions we just created
    assert len(jurisdictions) >= 2

    # Check that our jurisdictions are in the list
    jurisdiction_ids = [j.id for j in jurisdictions]
    assert "port-test" in jurisdiction_ids
    assert "spi-test" in jurisdiction_ids


def test_get_jurisdictions_by_location(db: Session) -> None:
    """Test retrieving jurisdictions for a specific location."""
    # Create two locations
    location1_id = "location-filter-1"
    location2_id = "location-filter-2"

    location1_in = LocationCreate(
        id=location1_id,
        name="Location Filter 1",
        state="Florida",
        slug="location-filter-1",
    )
    location2_in = LocationCreate(
        id=location2_id,
        name="Location Filter 2",
        state="Texas",
        slug="location-filter-2",
    )

    crud.create_location(session=db, location_in=location1_in)
    crud.create_location(session=db, location_in=location2_in)

    # Create jurisdictions for each location
    jurisdiction1 = JurisdictionCreate(
        id="jurisdiction-loc1-1",
        name="Jurisdiction Loc1 1",
        state="Florida",
        sales_tax_rate=0.07,
        location_id=location1_id,
        slug="jurisdiction-loc1-1",
    )
    jurisdiction2 = JurisdictionCreate(
        id="jurisdiction-loc1-2",
        name="Jurisdiction Loc1 2",
        state="Florida",
        sales_tax_rate=0.065,
        location_id=location1_id,
        slug="jurisdiction-loc1-2",
    )
    jurisdiction3 = JurisdictionCreate(
        id="jurisdiction-loc2-1",
        name="Jurisdiction Loc2 1",
        state="Texas",
        sales_tax_rate=0.0825,
        location_id=location2_id,
        slug="jurisdiction-loc2-1",
    )

    crud.create_jurisdiction(session=db, jurisdiction_in=jurisdiction1)
    crud.create_jurisdiction(session=db, jurisdiction_in=jurisdiction2)
    crud.create_jurisdiction(session=db, jurisdiction_in=jurisdiction3)

    # Get jurisdictions for location 1
    jurisdictions_loc1 = crud.get_jurisdictions_by_location(
        session=db, location_id=location1_id
    )

    # Should have 2 jurisdictions for location 1
    assert len(jurisdictions_loc1) == 2
    jurisdiction_ids = [j.id for j in jurisdictions_loc1]
    assert "jurisdiction-loc1-1" in jurisdiction_ids
    assert "jurisdiction-loc1-2" in jurisdiction_ids
    assert "jurisdiction-loc2-1" not in jurisdiction_ids

    # Get jurisdictions for location 2
    jurisdictions_loc2 = crud.get_jurisdictions_by_location(
        session=db, location_id=location2_id
    )

    # Should have 1 jurisdiction for location 2
    assert len(jurisdictions_loc2) == 1
    jurisdiction_ids = [j.id for j in jurisdictions_loc2]
    assert "jurisdiction-loc2-1" in jurisdiction_ids


def test_update_jurisdiction(db: Session) -> None:
    """Test updating a jurisdiction."""
    # Create a location
    location_id = "update-test-location-j1"
    location_in = LocationCreate(
        id=location_id,
        name="Update Test Location J1",
        state="Test State",
        slug="update-test-location-j1",
    )
    crud.create_location(session=db, location_in=location_in)

    # Create a jurisdiction
    jurisdiction_in = JurisdictionCreate(
        id="update-test-j1",
        name="Update Test J1",
        state="Test State",
        sales_tax_rate=0.06,
        location_id=location_id,
        slug="update-test-j1",
    )
    db_jurisdiction = crud.create_jurisdiction(
        session=db, jurisdiction_in=jurisdiction_in
    )

    # Update data
    update_in = JurisdictionUpdate(
        name="Updated Name J1",
        state="Updated State",
        sales_tax_rate=0.07,
    )

    # Update the jurisdiction
    updated_jurisdiction = crud.update_jurisdiction(
        session=db, db_obj=db_jurisdiction, obj_in=update_in
    )

    assert updated_jurisdiction.id == db_jurisdiction.id
    assert updated_jurisdiction.name == "Updated Name J1"
    assert updated_jurisdiction.state == "Updated State"
    assert updated_jurisdiction.sales_tax_rate == 0.07
    assert updated_jurisdiction.slug == "updated-name-j1"  # Slug should be auto-updated
    assert (
        updated_jurisdiction.location_id == location_id
    )  # location_id should not change


def test_delete_jurisdiction(db: Session) -> None:
    """Test deleting a jurisdiction."""
    # Create a location
    location_id = "delete-test-location-j1"
    location_in = LocationCreate(
        id=location_id,
        name="Delete Test Location J1",
        state="Test State",
        slug="delete-test-location-j1",
    )
    crud.create_location(session=db, location_in=location_in)

    # Create a jurisdiction
    jurisdiction_in = JurisdictionCreate(
        id="delete-test-j1",
        name="Delete Test J1",
        state="Test State",
        sales_tax_rate=0.06,
        location_id=location_id,
        slug="delete-test-j1",
    )
    db_jurisdiction = crud.create_jurisdiction(
        session=db, jurisdiction_in=jurisdiction_in
    )

    # Delete the jurisdiction
    crud.delete_jurisdiction(session=db, db_obj=db_jurisdiction)

    # Verify deletion
    jurisdiction = crud.get_jurisdiction(session=db, jurisdiction_id=db_jurisdiction.id)
    assert jurisdiction is None
