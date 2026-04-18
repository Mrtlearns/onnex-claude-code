from pydantic import BaseModel


class OrganizationBase(BaseModel):
    name: str
    industry: str | None = None


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationRead(OrganizationBase):
    id: int

    model_config = {"from_attributes": True}
