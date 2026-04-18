"""CMMC Compliance OS — FastAPI entry point."""
import asyncio
import logging
from contextlib import asynccontextmanager

import httpx
import redis.asyncio as aioredis

from app.logging_config import configure_logging, get_logger

configure_logging()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from minio import Minio

from app.config import settings
from app.database import create_pool
from app.routers import analytics, artifacts, assessments, assignments, audit, client_errors, controls, integrations, invites, msps, notifications, orgs, programs, reports, suggestions, triage, webhooks, ssp_interview
from app.services.minio_service import ensure_bucket

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- Startup -----------------------------------------------------------
    if not settings.webhook_secret or settings.webhook_secret == "changeme":
        raise RuntimeError(
            "WEBHOOK_SECRET env var must be set to a strong random value (not 'changeme' or empty)"
        )
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
    for bucket in ("cmmc-artifacts", "cmmc-reports", "cmmc-drafts", "cmmc-exports"):
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

from app.middleware.correlation import CorrelationIdMiddleware
from app.middleware.access_log import AccessLogMiddleware
from app.middleware.exception_handlers import register_exception_handlers

# CORS — allow frontend origin + local dev
_origins = [settings.app_url, "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware order: CorrelationId runs first (outermost), AccessLog wraps inside it
app.add_middleware(AccessLogMiddleware)
app.add_middleware(CorrelationIdMiddleware)

register_exception_handlers(app)

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
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(ssp_interview.router, prefix="/api/programs/{program_id}/ssp-interview", tags=["ssp_interview"])
app.include_router(integrations.router, prefix="/api/integrations", tags=["integrations"])
app.include_router(triage.router, prefix="/api/triage", tags=["triage"])
app.include_router(client_errors.router, prefix="/api/client-errors", tags=["client-errors"])


async def _check_postgres() -> str:
    try:
        async with app.state.pool.acquire() as conn:
            await asyncio.wait_for(conn.fetchval("SELECT 1"), timeout=3)
        return "up"
    except Exception:
        return "down"


async def _check_minio() -> str:
    try:
        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(None, app.state.minio.list_buckets), timeout=3
        )
        return "up"
    except Exception:
        return "down"


async def _check_redis() -> str:
    try:
        r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
        await asyncio.wait_for(r.ping(), timeout=3)
        await r.aclose()
        return "up"
    except Exception:
        return "down"


async def _check_n8n() -> str:
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{settings.n8n_internal_url}/healthz")
        return "up" if resp.status_code < 500 else "degraded"
    except Exception:
        return "down"


async def _check_openrouter() -> str:
    try:
        async with httpx.AsyncClient(timeout=4) as client:
            resp = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
            )
        return "up" if resp.status_code < 500 else "degraded"
    except Exception:
        return "down"


def _summarise(components: dict[str, str]) -> str:
    if all(v == "up" for v in components.values()):
        return "ok"
    if any(v == "down" for v in components.values()):
        return "down"
    return "degraded"


@app.get("/health")
async def health(request: Request):
    """Lightweight health check — Postgres, MinIO, Redis, n8n probed in parallel.

    Intentionally excludes OpenRouter (paid API — see /health/deep).
    This endpoint is safe to poll from Traefik/Docker healthchecks.
    """
    postgres, minio, redis, n8n = await asyncio.gather(
        _check_postgres(),
        _check_minio(),
        _check_redis(),
        _check_n8n(),
    )
    components = {"postgres": postgres, "minio": minio, "redis": redis, "n8n": n8n}

    return {
        "status": _summarise(components),
        "service": "cmmc-api",
        "components": components,
        "correlation_id": getattr(request.state, "correlation_id", None),
    }


@app.get("/health/deep")
async def health_deep(request: Request):
    """Full health check including paid external APIs. Admin/ops use only — do NOT poll."""
    postgres, minio, redis, n8n, openrouter = await asyncio.gather(
        _check_postgres(),
        _check_minio(),
        _check_redis(),
        _check_n8n(),
        _check_openrouter(),
    )
    components = {
        "postgres": postgres,
        "minio": minio,
        "redis": redis,
        "n8n": n8n,
        "openrouter": openrouter,
    }

    return {
        "status": _summarise(components),
        "service": "cmmc-api",
        "components": components,
        "correlation_id": getattr(request.state, "correlation_id", None),
    }
