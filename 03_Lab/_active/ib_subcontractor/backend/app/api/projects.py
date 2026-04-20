from fastapi import APIRouter

from app.schemas.project import ProjectRead


router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=list[ProjectRead])
async def list_projects() -> list[ProjectRead]:
    return [
        ProjectRead(
            id=1,
            name="Terminal Expansion",
            description="MVP demo project",
            organization_id=1,
        )
    ]
