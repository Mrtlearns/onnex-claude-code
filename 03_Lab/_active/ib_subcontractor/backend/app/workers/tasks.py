from app.workers.celery_app import celery_app


@celery_app.task
def scan_expiring_certifications() -> dict[str, str]:
    return {"status": "scheduled"}
