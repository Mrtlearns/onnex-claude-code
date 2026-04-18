from datetime import date

from fastapi import APIRouter

from app.schemas.certification import CertificationRead


router = APIRouter(prefix="/certifications", tags=["certifications"])


@router.get("/", response_model=list[CertificationRead])
async def list_certifications() -> list[CertificationRead]:
    return [
        CertificationRead(
            id=1,
            name="General Liability",
            document_url="https://example.com/cert.pdf",
            expiry_date=date(2026, 12, 31),
            subcontractor_id=1,
        )
    ]
