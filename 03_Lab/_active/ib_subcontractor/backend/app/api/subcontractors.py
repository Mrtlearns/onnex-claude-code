from fastapi import APIRouter

from app.schemas.subcontractor import SubcontractorRead


router = APIRouter(prefix="/subcontractors", tags=["subcontractors"])


@router.get("/", response_model=list[SubcontractorRead])
async def list_subcontractors() -> list[SubcontractorRead]:
    return [SubcontractorRead(id=1, name="Acme Mechanical", trade="HVAC", project_id=1)]
