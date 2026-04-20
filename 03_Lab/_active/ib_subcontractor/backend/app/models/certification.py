from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Certification(Base):
    __tablename__ = "certifications"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    document_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subcontractor_id: Mapped[int] = mapped_column(ForeignKey("subcontractors.id"), nullable=False)

    subcontractor = relationship("Subcontractor", back_populates="certifications")
