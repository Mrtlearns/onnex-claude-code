from fastapi import APIRouter

from app.schemas.organization import OrganizationRead


router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/", response_model=list[OrganizationRead])
async def list_organizations() -> list[OrganizationRead]:
    return [OrganizationRead(id=1, name="Demo GC", industry="Construction")]
