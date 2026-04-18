from datetime import date

from pydantic import BaseModel


class OshaViolationBase(BaseModel):
    citation_type: str
    description: str | None = None
    inspection_date: date | None = None
    subcontractor_id: int


class OshaViolationCreate(OshaViolationBase):
    pass


class OshaViolationRead(OshaViolationBase):
    id: int

    model_config = {"from_attributes": True}
