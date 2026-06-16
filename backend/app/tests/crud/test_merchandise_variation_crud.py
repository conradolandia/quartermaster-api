"""Direct tests for `app.crud.merchandise_variation`."""

import uuid

from sqlmodel import Session

from app.crud.merchandise_variation import (
    create_merchandise_variation,
    delete_merchandise_variation,
    get_merchandise_variation,
    get_merchandise_variation_by_merchandise_and_value,
    list_merchandise_variations_by_merchandise,
    update_merchandise_variation,
)
from app.models import (
    Merchandise,
    MerchandiseVariationCreate,
    MerchandiseVariationUpdate,
)


def test_get_merchandise_variation_returns_instance(
    db: Session,
    test_merchandise: Merchandise,
) -> None:
    created = create_merchandise_variation(
        session=db,
        variation_in=MerchandiseVariationCreate(
            merchandise_id=test_merchandise.id,
            variant_value="M",
            quantity_total=5,
        ),
    )
    found = get_merchandise_variation(session=db, variation_id=created.id)
    assert found is not None
    assert found.id == created.id


def test_get_merchandise_variation_returns_none_for_missing(db: Session) -> None:
    assert get_merchandise_variation(session=db, variation_id=uuid.uuid4()) is None


def test_get_merchandise_variation_by_merchandise_and_value(
    db: Session,
    test_merchandise: Merchandise,
) -> None:
    create_merchandise_variation(
        session=db,
        variation_in=MerchandiseVariationCreate(
            merchandise_id=test_merchandise.id,
            variant_value="L",
            quantity_total=3,
        ),
    )
    found = get_merchandise_variation_by_merchandise_and_value(
        session=db,
        merchandise_id=test_merchandise.id,
        variant_value="L",
    )
    assert found is not None
    assert found.variant_value == "L"


def test_list_merchandise_variations_orders_by_variant_value(
    db: Session,
    test_merchandise: Merchandise,
) -> None:
    for value in ("Z", "A"):
        create_merchandise_variation(
            session=db,
            variation_in=MerchandiseVariationCreate(
                merchandise_id=test_merchandise.id,
                variant_value=value,
                quantity_total=1,
            ),
        )
    variations = list_merchandise_variations_by_merchandise(
        session=db, merchandise_id=test_merchandise.id
    )
    values = [v.variant_value for v in variations if v.variant_value in ("A", "Z")]
    assert values == ["A", "Z"]


def test_update_merchandise_variation_strips_variant_value(
    db: Session,
    test_merchandise: Merchandise,
) -> None:
    created = create_merchandise_variation(
        session=db,
        variation_in=MerchandiseVariationCreate(
            merchandise_id=test_merchandise.id,
            variant_value="S",
            quantity_total=4,
        ),
    )
    updated = update_merchandise_variation(
        session=db,
        db_obj=created,
        obj_in=MerchandiseVariationUpdate(
            variant_value="  XL  ",
            quantity_total=10,
            quantity_sold=2,
            quantity_fulfilled=1,
        ),
    )
    assert updated.variant_value == "XL"
    assert updated.quantity_total == 10
    assert updated.quantity_sold == 2
    assert updated.quantity_fulfilled == 1


def test_delete_merchandise_variation_returns_none_when_missing(db: Session) -> None:
    assert delete_merchandise_variation(session=db, variation_id=uuid.uuid4()) is None


def test_delete_merchandise_variation_deletes_row(
    db: Session,
    test_merchandise: Merchandise,
) -> None:
    created = create_merchandise_variation(
        session=db,
        variation_in=MerchandiseVariationCreate(
            merchandise_id=test_merchandise.id,
            variant_value="Delete Me",
            quantity_total=1,
        ),
    )
    deleted = delete_merchandise_variation(session=db, variation_id=created.id)
    assert deleted is not None
    assert get_merchandise_variation(session=db, variation_id=created.id) is None
