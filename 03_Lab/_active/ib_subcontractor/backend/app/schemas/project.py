from pydantic import BaseModel


class ProjectBase(BaseModel):
    name: str
    description: str | None = None
    organization_id: int


class ProjectCreate(ProjectBase):
    pass


class ProjectRead(ProjectBase):
    id: int

    model_config = {"from_attributes": True}
