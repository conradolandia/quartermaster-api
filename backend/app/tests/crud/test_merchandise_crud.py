"""Direct tests for `app.crud.merchandise`."""

import uuid

import pytest
from sqlmodel import Session, select

from app.crud.merchandise import (
    create_merchandise,
    delete_merchandise,
    get_merchandise,
    get_merchandise_count,
    get_merchandise_list,
    update_merchandise,
)
from app.models import (
    Boat,
    Booking,
    BookingItem,
    BookingItemStatus,
    Merchandise,
    MerchandiseCreate,
    MerchandiseUpdate,
    MerchandiseVariation,
    Trip,
    TripMerchandise,
)


def test_get_merchandise_returns_instance(
    db: Session,
    test_merchandise: Merchandise,
) -> None:
    """`get_merchandise` should return the matching row by id."""
    found = get_merchandise(session=db, merchandise_id=test_merchandise.id)
    assert isinstance(found, Merchandise)
    assert found.id == test_merchandise.id


def test_get_merchandise_returns_none_for_missing(db: Session) -> None:
    """`get_merchandise` should return None when not found."""
    missing = get_merchandise(session=db, merchandise_id=uuid.uuid4())
    assert missing is None


def test_get_merchandise_list_paginates_and_orders_by_name(db: Session) -> None:
    """`get_merchandise_list` should apply ordering and pagination."""
    # Create three items with names that sort lexicographically
    names = ["Alpha Shirt", "Beta Cap", "Omega Hoodie"]
    for name in names:
        merch = Merchandise(
            name=name,
            description="Test",
            price=1000,
            quantity_available=5,
        )
        db.add(merch)
    db.commit()

    # Sorted by name ascending (DB may contain seed merchandise)
    all_items = get_merchandise_list(session=db, skip=0, limit=10)
    sorted_names = [m.name for m in all_items]
    our_names_in_order = [n for n in sorted_names if n in names]
    assert our_names_in_order == sorted(names)

    # Pagination: skip the first, take one
    page = get_merchandise_list(session=db, skip=1, limit=1)
    assert len(page) == 1
    assert page[0].name == sorted(names)[1]


def test_get_merchandise_count_returns_total_rows(
    db: Session,
    test_merchandise: Merchandise,
) -> None:
    """`get_merchandise_count` should reflect number of rows."""
    # There is at least one row from the fixture
    initial_count = get_merchandise_count(session=db)

    extra = Merchandise(
        name="Extra Item",
        description="Extra",
        price=500,
        quantity_available=3,
    )
    db.add(extra)
    db.commit()

    updated_count = get_merchandise_count(session=db)
    assert updated_count == initial_count + 1


def test_create_merchandise_creates_row_and_default_variation(db: Session) -> None:
    """`create_merchandise` should insert a merchandise and a default variation."""
    create_in = MerchandiseCreate(
        name="Created Item",
        description="From CRUD test",
        price=2500,
        quantity_available=7,
    )

    created = create_merchandise(session=db, merchandise_in=create_in)
    assert isinstance(created, Merchandise)
    assert created.name == "Created Item"
    assert created.quantity_available == 7

    # Default variation should exist and mirror quantity_available into quantity_total
    variations = db.exec(
        select(MerchandiseVariation).where(
            MerchandiseVariation.merchandise_id == created.id
        )
    ).all()
    assert len(variations) == 1
    v = variations[0]
    assert v.variant_value == ""
    assert v.quantity_total == 7
    assert v.quantity_sold == 0
    assert v.quantity_fulfilled == 0


def test_update_merchandise_updates_persisted_fields(
    db: Session,
    test_merchandise: Merchandise,
) -> None:
    """`update_merchandise` should mutate and persist core fields."""
    original_id = test_merchandise.id
    original_price = test_merchandise.price
    original_qty = test_merchandise.quantity_available or 0

    update_in = MerchandiseUpdate(
        name="Updated Name",
        description="Updated description",
        price=original_price + 123,
        quantity_available=original_qty + 5,
    )

    updated = update_merchandise(session=db, db_obj=test_merchandise, obj_in=update_in)

    assert updated.id == original_id
    assert updated.name == "Updated Name"
    assert updated.description == "Updated description"
    assert updated.price == original_price + 123
    assert updated.quantity_available == original_qty + 5

    # Verify the changes were flushed to the database
    reloaded = db.get(Merchandise, original_id)
    assert reloaded is not None
    assert reloaded.name == "Updated Name"
    assert reloaded.description == "Updated description"
    assert reloaded.price == original_price + 123
    assert reloaded.quantity_available == original_qty + 5


def test_delete_merchandise_returns_none_when_not_found(db: Session) -> None:
    """Deleting a non-existent merchandise should return None."""
    missing_id = uuid.uuid4()

    result = delete_merchandise(session=db, merchandise_id=missing_id)

    assert result is None


def test_delete_merchandise_raises_when_trip_references_merchandise(
    db: Session,
    test_trip: Trip,
    test_merchandise: Merchandise,
) -> None:
    """If a trip references the merchandise, deletion should fail."""
    trip_merch = TripMerchandise(
        trip_id=test_trip.id,
        merchandise_id=test_merchandise.id,
        quantity_available_override=None,
        price_override=None,
    )
    db.add(trip_merch)
    db.commit()

    with pytest.raises(ValueError) as exc:
        delete_merchandise(session=db, merchandise_id=test_merchandise.id)

    assert "still offered on one or more trips" in str(exc.value)


def test_delete_merchandise_raises_when_booking_item_references_variation(
    db: Session,
    test_trip: Trip,
    test_boat: Boat,
    test_booking: Booking,
    test_merchandise: Merchandise,
) -> None:
    """If any booking item references a variation, deletion should fail."""
    variation = MerchandiseVariation(
        merchandise_id=test_merchandise.id,
        variant_value="",
        quantity_total=10,
        quantity_sold=0,
        quantity_fulfilled=0,
    )
    db.add(variation)
    db.commit()
    db.refresh(variation)

    item = BookingItem(
        booking_id=test_booking.id,
        trip_id=test_trip.id,
        boat_id=test_boat.id,
        item_type="merch",
        quantity=1,
        price_per_unit=test_merchandise.price,
        status=BookingItemStatus.active,
        merchandise_variation_id=variation.id,
    )
    db.add(item)
    db.commit()

    with pytest.raises(ValueError) as exc:
        delete_merchandise(session=db, merchandise_id=test_merchandise.id)

    assert "referenced by booking items" in str(exc.value)


def test_delete_merchandise_deletes_variations_and_merchandise(
    db: Session,
    test_merchandise: Merchandise,
) -> None:
    """Successful delete should remove merchandise and its variations."""
    variation = MerchandiseVariation(
        merchandise_id=test_merchandise.id,
        variant_value="L",
        quantity_total=5,
        quantity_sold=0,
        quantity_fulfilled=0,
    )
    db.add(variation)
    db.commit()

    deleted = delete_merchandise(session=db, merchandise_id=test_merchandise.id)

    assert deleted is not None
    assert db.get(Merchandise, test_merchandise.id) is None

    remaining_variations = db.exec(
        select(MerchandiseVariation).where(
            MerchandiseVariation.merchandise_id == test_merchandise.id
        )
    ).all()
    assert remaining_variations == []
