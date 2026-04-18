from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    message: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="yellow")
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    subcontractor_id: Mapped[int | None] = mapped_column(ForeignKey("subcontractors.id"), nullable=True)

    subcontractor = relationship("Subcontractor", back_populates="alerts")
