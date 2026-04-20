from pydantic import BaseModel


class SubcontractorBase(BaseModel):
    name: str
    trade: str | None = None
    project_id: int | None = None


class SubcontractorCreate(SubcontractorBase):
    pass


class SubcontractorRead(SubcontractorBase):
    id: int

    model_config = {"from_attributes": True}
