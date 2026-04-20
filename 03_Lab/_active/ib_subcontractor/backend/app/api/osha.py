from datetime import date

from fastapi import APIRouter

from app.schemas.osha import OshaViolationRead


router = APIRouter(prefix="/osha", tags=["osha"])


@router.get("/", response_model=list[OshaViolationRead])
async def list_osha_violations() -> list[OshaViolationRead]:
    return [
        OshaViolationRead(
            id=1,
            citation_type="serious",
            description="Guardrail deficiency",
            inspection_date=date(2025, 6, 1),
            subcontractor_id=1,
        )
    ]
