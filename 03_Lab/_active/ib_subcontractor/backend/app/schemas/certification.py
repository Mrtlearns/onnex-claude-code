from datetime import date

from pydantic import BaseModel


class CertificationBase(BaseModel):
    name: str
    document_url: str | None = None
    expiry_date: date | None = None
    subcontractor_id: int


class CertificationCreate(CertificationBase):
    pass


class CertificationRead(CertificationBase):
    id: int

    model_config = {"from_attributes": True}
