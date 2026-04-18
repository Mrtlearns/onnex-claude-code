from celery import Celery

from app.config import get_settings


settings = get_settings()

celery_app = Celery(
    "prequal",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.tasks"],
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "scan-expiring-certs": {
            "task": "app.workers.tasks.scan_expiring_certifications",
            "schedule": 3600.0,
        }
    },
)
