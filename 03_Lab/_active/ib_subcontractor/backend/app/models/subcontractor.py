from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Subcontractor(Base):
    __tablename__ = "subcontractors"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    trade: Mapped[str | None] = mapped_column(String(120), nullable=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True)

    project = relationship("Project", back_populates="subcontractors")
    certifications = relationship("Certification", back_populates="subcontractor")
    violations = relationship("OshaViolation", back_populates="subcontractor")
    alerts = relationship("Alert", back_populates="subcontractor")
