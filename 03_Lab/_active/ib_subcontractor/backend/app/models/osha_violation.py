from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OshaViolation(Base):
    __tablename__ = "osha_violations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    citation_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    inspection_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subcontractor_id: Mapped[int] = mapped_column(ForeignKey("subcontractors.id"), nullable=False)

    subcontractor = relationship("Subcontractor", back_populates="violations")
