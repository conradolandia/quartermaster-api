"""Trip operations (e.g. YAML import). Superuser only."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlmodel import Session

from app.api import deps
from app.api.deps import get_current_active_superuser
from app.models import TripPublic
from app.services.yaml_importer import YamlImporter
from app.services.yaml_validator import YamlValidationError

from .trip_utils import trip_to_public

router = APIRouter(prefix="/trips", tags=["trips"])


@router.post(
    "/import-yaml",
    response_model=TripPublic,
    dependencies=[Depends(get_current_active_superuser)],
)
def import_trip_from_yaml(
    *,
    session: Session = Depends(deps.get_db),
    file: UploadFile = File(...),
):
    """
    Import a trip from YAML file.

    Expected YAML format:
    ```yaml
    name: "Mars Sample Return Viewing Experience"
    mission_id: "mars-sample-return"
    type: "launch_viewing"
    base_price: 299.99
    departure_time: "2024-03-15T10:00:00Z"
    return_time: "2024-03-15T18:00:00Z"
    departure_location_id: "port-canaveral-marina"
    description: "Watch the historic Mars Sample Return launch"
    max_capacity: 50
    ```
    """
    try:
        if not file.filename.endswith((".yaml", ".yml")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be a YAML file (.yaml or .yml)",
            )

        yaml_content = file.file.read().decode("utf-8")
        importer = YamlImporter(session)
        trip = importer.import_trip(yaml_content)

        return trip_to_public(session, trip)

    except YamlValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"YAML validation error: {e.message}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import trip: {str(e)}",
        )
