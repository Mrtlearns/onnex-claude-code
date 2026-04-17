"""CMMC Compliance OS — FastAPI entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from minio import Minio

from app.config import settings
from app.database import create_pool
from app.routers import artifacts, assessments, assignments, controls, invites, msps, notifications, orgs, programs, reports, suggestions, webhooks
from app.services.minio_service import ensure_bucket

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- Startup -----------------------------------------------------------
    app.state.pool = await create_pool()

    app.state.minio = Minio(
        settings.minio_endpoint_clean,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )

    # Public client — signs presigned URLs with the public hostname so browsers
    # can PUT/GET directly without HMAC host-mismatch errors.
    if settings.minio_public_url:
        from urllib.parse import urlparse as _up
        _pub = _up(settings.minio_public_url.rstrip("/"))
        app.state.minio_public = Minio(
            _pub.netloc,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=_pub.scheme == "https",
        )
    else:
        app.state.minio_public = app.state.minio

    # Ensure required buckets exist — non-fatal: bad credentials shouldn't
    # prevent startup; artifact endpoints will fail at request time instead.
    for bucket in ("cmmc-artifacts", "cmmc-reports"):
        try:
            ensure_bucket(app.state.minio, bucket)
        except Exception as exc:
            logger.warning("MinIO bucket check failed for %r: %s — check MINIO_ACCESS_KEY/MINIO_SECRET_KEY", bucket, exc)

    yield

    # ---- Shutdown ----------------------------------------------------------
    await app.state.pool.close()


app = FastAPI(
    title="CMMC API",
    version="0.1.0",
    docs_url="/api/docs",
    lifespan=lifespan,
)

# CORS — allow frontend origin + local dev
_origins = [settings.app_url, "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(msps.router, prefix="/api/msps", tags=["msps"])
app.include_router(orgs.router, prefix="/api/orgs", tags=["orgs"])
app.include_router(assignments.router, prefix="/api/assignments", tags=["assignments"])
app.include_router(invites.router, prefix="/api/invites", tags=["invites"])
app.include_router(programs.router, prefix="/api/programs", tags=["programs"])
app.include_router(controls.router, prefix="/api/controls", tags=["controls"])
app.include_router(artifacts.router, prefix="/api/artifacts", tags=["artifacts"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(assessments.router, prefix="/api/assessments", tags=["assessments"])
app.include_router(suggestions.router, prefix="/api/artifacts", tags=["suggestions"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])


@app.get("/health")
async def health():
    """Health check — verifies DB connectivity."""
    db_ok = False
    try:
        async with app.state.pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        db_ok = True
    except Exception:
        pass

    return {
        "status": "ok" if db_ok else "degraded",
        "service": "cmmc-api",
        "db": "up" if db_ok else "down",
    }
