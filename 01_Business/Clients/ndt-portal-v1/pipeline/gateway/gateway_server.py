"""Gateway microservice — FastAPI, port 8012.

Endpoints:
  POST /analyze                  — Route sanitized text to LLM (provider from DB config)
  POST /reidentify               — Post-LLM token reversal (quote_engine role)
  GET  /request/{request_id}    — Retrieve a gateway request record
  GET  /health                   — Health check
"""
from __future__ import annotations

import logging
import sys
import os
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))
from models import (  # noqa: E402
    AnalyzeRequest, AnalyzeResponse,
    GatewayReidentifyRequest, GatewayReidentifyResponse,
    ImagePayload, LLMRouting,
)
from db import get_pool, close_pool  # noqa: E402

from llm_router import resolve_routing
from second_pass import scan_prompt, ResidualPIIError
from providers import anthropic_provider, ollama_provider, openrouter_provider, openai_provider, gemini_provider, claude_cli_provider
from pipeline_runner import run_pipeline

logger = logging.getLogger("gateway")
logging.basicConfig(level=logging.INFO)

SANITIZE_URL       = os.environ.get("SANITIZE_URL", "http://sanitize:8011")
PRESIDIO_IMAGE_URL = os.environ.get("PRESIDIO_IMAGE_URL", "http://presidio-image-redactor:5002")


async def redact_image(data_b64: str, media_type: str) -> str:
    """Send image to Presidio image redactor. Returns redacted base64 string.
    Falls back to original if redaction service unavailable."""
    import base64
    try:
        raw = base64.b64decode(data_b64)
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{PRESIDIO_IMAGE_URL}/redact",
                content=raw,
                headers={"Content-Type": media_type},
            )
            resp.raise_for_status()
            return base64.b64encode(resp.content).decode()
    except Exception as e:
        logger.warning("redact_image: Presidio unavailable (%s) — using original", e)
        return data_b64


# ── LLM config cache ────────────────────────────────────────────────────────

_llm_config_cache: dict | None = None
_llm_config_cached_at: float = 0.0
_LLM_CACHE_TTL = 60.0  # seconds


async def get_llm_config() -> dict:
    """Read LLM provider config from ut.app_settings, cached for 60 seconds.

    Returns dict with keys: provider, model, api_key.
    Falls back to env var ANTHROPIC_API_KEY / provider 'anthropic' if DB
    read fails or api_key is empty.
    """
    global _llm_config_cache, _llm_config_cached_at

    now = time.monotonic()
    if _llm_config_cache is not None and (now - _llm_config_cached_at) < _LLM_CACHE_TTL:
        return _llm_config_cache

    try:
        pool = await get_pool()
        rows = await pool.fetch(
            "SELECT key, value FROM ut.app_settings "
            "WHERE key IN ('llm_provider', 'llm_model', 'llm_api_key', 'llm_auth_method')"
        )
        cfg: dict[str, str] = {r["key"]: r["value"] for r in rows}
        provider    = cfg.get("llm_provider",   "")
        model       = cfg.get("llm_model",      "")
        api_key     = cfg.get("llm_api_key",    "")
        auth_method = cfg.get("llm_auth_method", "oauth_cli")

        if auth_method != "oauth_cli" and not api_key:
            raise ValueError("llm_api_key is empty in DB — falling back to env")

        _llm_config_cache = {
            "provider":    provider,
            "model":       model,
            "api_key":     api_key,
            "auth_method": auth_method,
        }
        _llm_config_cached_at = now
        return _llm_config_cache

    except Exception as e:
        logger.warning("get_llm_config: DB read failed or key empty (%s) — using env fallback", e)
        fallback = {
            "provider": "anthropic",
            "model":    "claude-haiku-4-5-20251001",
            "api_key":  os.environ.get("ANTHROPIC_API_KEY", ""),
        }
        # Cache the fallback briefly to avoid hammering DB on every request
        fallback["auth_method"] = "api_key"
        _llm_config_cache = fallback
        _llm_config_cached_at = now
        return fallback


async def get_provider_config(provider: str) -> dict:
    """Look up a specific provider's API key and model from ut.app_settings.

    Used when a pipeline step specifies a provider override.
    Returns dict with keys: provider, model, api_key.
    """
    try:
        pool = await get_pool()
        rows = await pool.fetch(
            "SELECT key, value FROM ut.app_settings WHERE key IN ($1, $2)",
            f"{provider}_api_key",
            f"{provider}_model",
        )
        cfg: dict[str, str] = {r["key"]: r["value"] for r in rows}
        return {
            "provider": provider,
            "model":    cfg.get(f"{provider}_model", ""),
            "api_key":  cfg.get(f"{provider}_api_key", ""),
        }
    except Exception as e:
        logger.warning("get_provider_config(%s): DB read failed (%s)", provider, e)
        return {"provider": provider, "model": "", "api_key": ""}


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    logger.info("gateway service ready")
    yield
    await close_pool()


app = FastAPI(title="NDT Gateway Service", lifespan=lifespan)


# ── Routes ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "gateway"}


@app.post("/v1/pipeline/run")
async def pipeline_run(req: dict):
    """Trigger the email-to-quote pipeline for a given email_quote."""
    email_quote_id = req.get("emailQuoteId")
    pipeline_type = req.get("pipelineType", "00-PRE")
    if not email_quote_id:
        raise HTTPException(status_code=400, detail="emailQuoteId is required")
    try:
        result = await run_pipeline(email_quote_id, pipeline_type)
        return result
    except Exception as e:
        logger.error("pipeline_run failed: %s", e)
        try:
            pool = await get_pool()
            await pool.execute(
                "UPDATE app.email_quotes SET status='failed', pipeline_error=$1, updated_at=now() WHERE id=$2::uuid",
                str(e), email_quote_id,
            )
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/chat")
async def chat(req: dict):
    """Lightweight LLM chat — used by API for classification tasks."""
    messages = req.get("messages", [])
    system = req.get("system", "")
    max_tokens = req.get("max_tokens", 256)
    model = req.get("model", "anthropic/claude-haiku-4-5-20251001")
    user_text = messages[0].get("content", "") if messages else ""
    try:
        llm_cfg = await get_llm_config()
        api_key = llm_cfg.get("api_key", "")
        provider = llm_cfg.get("provider", "openrouter")
        if provider == "openrouter" or not api_key:
            # Use OpenRouter with the DB key
            or_key = api_key or os.environ.get("OPENROUTER_API_KEY", "")
            response_data, _, _ = await openrouter_provider.call(
                prompt=user_text,
                system_prompt=system,
                model=model if "/" in model else f"anthropic/{model}",
                api_key=or_key,
                max_tokens=max_tokens,
            )
        else:
            response_data, _, _ = await anthropic_provider.call(
                prompt=user_text,
                system_prompt=system,
                max_tokens=max_tokens,
            )
        return {"content": [{"text": response_data.get("text", "")}]}
    except Exception as e:
        logger.error("chat failed: %s", e)
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    # Resolve routing — raises ValueError if HOLD
    # This also enforces ITAR/EAR_HIGH → LOCAL_ONLY regardless of config
    try:
        routing_provider, routing_model = resolve_routing(req.llm_routing, req.classification)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Second-pass PII scan before any LLM call
    try:
        scan_prompt(req.prompt, req.llm_routing)
    except ResidualPIIError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Residual PII/CUI detected — cannot send to cloud: {e.matches[:3]}",
        )

    # If routing is LOCAL_ONLY (ITAR/EAR_HIGH), always use Ollama regardless of any override
    if routing_provider == "ollama":
        provider = "ollama"
        model    = routing_model
    else:
        # CLOUD_OK — check auth method to determine provider
        llm_cfg     = await get_llm_config()
        auth_method = llm_cfg.get("auth_method", "oauth_cli")

        if auth_method == "oauth_cli":
            # Route all CLOUD_OK calls through the claude CLI (OAuth token).
            # Images are embedded as base64 blocks in the stream-json message.
            provider = "claude_cli"
            raw_model = req.model or "claude-sonnet-4-6"
            # Strip OpenRouter-style prefix (e.g. "anthropic/claude-sonnet-4-5" → "claude-sonnet-4-5")
            model = raw_model.split("/", 1)[-1] if "/" in raw_model else raw_model
        elif req.provider and req.provider not in ("ollama", ""):
            # Step-level provider override (api_key mode only)
            step_cfg = await get_provider_config(req.provider)
            provider = step_cfg["provider"]
            model    = req.model or step_cfg["model"] or ""
            api_key  = step_cfg["api_key"]
            if not api_key:
                logger.warning(
                    "analyze: step override provider '%s' has no API key — falling back to default",
                    provider,
                )
                provider = llm_cfg["provider"]
                model    = llm_cfg["model"]
                api_key  = llm_cfg["api_key"]
        else:
            # Default api_key path — read provider from DB config
            provider = llm_cfg["provider"]
            model    = req.model or llm_cfg["model"]   # honour per-step model override
            api_key  = llm_cfg["api_key"]

    # Redact images if present and routing allows cloud
    images_to_send = req.images
    if req.images and routing_provider != "ollama":
        images_to_send = [
            ImagePayload(
                media_type=img.media_type,
                data_b64=await redact_image(img.data_b64, img.media_type),
            )
            for img in req.images
        ]

    # Build kwargs for max_tokens so we only pass it when the caller set it
    # (lets each provider keep its own default when req.max_tokens is None)
    mt_kwargs: dict = {"max_tokens": req.max_tokens} if req.max_tokens else {}

    # Call the appropriate provider
    t0 = time.monotonic()
    try:
        if provider == "ollama":
            response_data, prompt_tokens, completion_tokens = await ollama_provider.call(
                prompt=req.prompt,
                system_prompt=req.system_prompt,
                images=images_to_send,
                model=req.model or None,
                **mt_kwargs,
            )
        elif provider == "claude_cli":
            response_data, prompt_tokens, completion_tokens = await claude_cli_provider.call(
                prompt=req.prompt,
                system_prompt=req.system_prompt,
                images=images_to_send,
                model=model or None,
                **mt_kwargs,
            )
        elif provider == "anthropic":
            response_data, prompt_tokens, completion_tokens = await anthropic_provider.call(
                prompt=req.prompt,
                system_prompt=req.system_prompt,
                images=images_to_send,
                **mt_kwargs,
            )
        elif provider == "openrouter":
            response_data, prompt_tokens, completion_tokens = await openrouter_provider.call(
                prompt=req.prompt,
                system_prompt=req.system_prompt,
                model=model,
                api_key=api_key,
                images=images_to_send,
                **mt_kwargs,
            )
        elif provider == "openai":
            response_data, prompt_tokens, completion_tokens = await openai_provider.call(
                prompt=req.prompt,
                system_prompt=req.system_prompt,
                model=model,
                api_key=api_key,
                images=images_to_send,
                **mt_kwargs,
            )
        elif provider == "gemini":
            response_data, prompt_tokens, completion_tokens = await gemini_provider.call(
                prompt=req.prompt,
                system_prompt=req.system_prompt,
                model=model,
                api_key=api_key,
                **mt_kwargs,
            )
        else:
            # Unknown provider — fall back to anthropic
            logger.warning("Unknown provider '%s' — falling back to anthropic", provider)
            response_data, prompt_tokens, completion_tokens = await anthropic_provider.call(
                prompt=req.prompt,
                system_prompt=req.system_prompt,
                images=images_to_send,
                **mt_kwargs,
            )
    except Exception as e:
        logger.error("LLM call failed [%s/%s]: %s", provider, model, e)
        raise HTTPException(status_code=502, detail=f"LLM provider error: {e}")

    latency_ms = int((time.monotonic() - t0) * 1000)

    logger.info(
        "analyze: provider=%s model=%s classification=%s tokens=%s/%s latency=%dms",
        provider, model, req.classification, prompt_tokens, completion_tokens, latency_ms,
    )

    # Store in DB (response_json contains parsed result — tokens only, never plaintext)
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO pipeline.gateway_requests
            (intake_id, sanitize_job_id, provider_used, model_used,
             classification, llm_routing, prompt_tokens, completion_tokens,
             latency_ms, response_json)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
        RETURNING id::text
        """,
        req.intake_id,
        req.sanitize_job_id,
        provider,
        model,
        req.classification.value,
        req.llm_routing.value,
        prompt_tokens,
        completion_tokens,
        latency_ms,
        __import__("json").dumps(response_data.get("parsed", {})),
    )
    request_id = row["id"]

    return AnalyzeResponse(
        request_id=request_id,
        provider_used=provider,
        model_used=model,
        response_json=response_data.get("parsed", {}),
        prompt_tokens=prompt_tokens,
        latency_ms=latency_ms,
    )


@app.post("/reidentify", response_model=GatewayReidentifyResponse)
async def reidentify(req: GatewayReidentifyRequest):
    """Re-identify tokens in LLM output text.

    Proxies to sanitize service's /reidentify endpoint.
    Caller role governs which entity types are revealed.
    Only quote_engine role is allowed to reveal ORGANIZATION + PART_NUMBER.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                f"{SANITIZE_URL}/reidentify",
                json={
                    "job_id":      req.sanitize_job_id,
                    "text":        req.text,
                    "caller_role": req.caller_role,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Sanitize reidentify error: {e}")

    pool = await get_pool()
    await pool.execute(
        """
        INSERT INTO pipeline.gateway_reidentify_log
            (gateway_req_id, caller_role, tokens_revealed)
        VALUES ($1::uuid, $2, $3)
        """,
        req.gateway_req_id,
        req.caller_role,
        data.get("tokens_revealed", []),
    )

    return GatewayReidentifyResponse(
        reidentified_text=data["reidentified_text"],
        tokens_revealed=data.get("tokens_revealed", []),
    )


@app.get("/request/{request_id}")
async def get_request(request_id: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM pipeline.gateway_requests WHERE id = $1::uuid",
        request_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Request not found")
    return dict(row)
