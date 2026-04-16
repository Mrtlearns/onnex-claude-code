"""Pipeline runner — orchestrates email-to-quote flow.

Called by gateway_server.py POST /v1/pipeline/run.
Flow: fetch email_quote → LLM extract dimensions → call UT calculator → update status.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))
from db import get_pool  # noqa: E402

from providers import openrouter_provider  # noqa: E402

logger = logging.getLogger("pipeline_runner")

API_URL = os.environ.get("API_URL", "http://api:3100")
INTERNAL_SECRET = os.environ.get("INTERNAL_SECRET", "")
N8N_REPLY_URL = os.environ.get("N8N_EMAIL_REPLY_URL", "http://n8n:5678/webhook/ndt-email-reply")
N8N_INTERNAL_SECRET = os.environ.get("N8N_INTERNAL_SECRET", "")

# ── LLM system prompt for dimension extraction ──────────────────────────────

EXTRACTION_PROMPT = """You are an expert NDT (Non-Destructive Testing) dimension extractor.

Given an email requesting an inspection quote, extract the part geometry and dimensions.

GEOMETRY TYPES (pick the best match):
- FLAT_BAR: flat plate, bar, block → needs thickness, width, length
- ROUND_BAR: solid round bar, rod, shaft → needs diameter, length
- RING: hollow ring, cylinder, bushing → needs outerDiameter, innerDiameter, length
- TUBING: tube, pipe → needs diameter (OD), length, numberOfScans (default 1)
- CSCAN_FLAT: flat part needing C-scan → needs thickness, width, length
- CSCAN_ROUND: round part needing C-scan → needs diameter, length
- THIN_SHEET: thin sheet or plate (< 0.5 inch thick) → needs thickness, width, length

IMPORTANT RULES:
- All dimensions in INCHES. Convert from mm (÷25.4), cm (÷2.54), or feet (×12) if needed.
- If quantity is not stated, default to 1.
- If a dimension is mentioned as a fraction (e.g., 3/8"), convert to decimal (0.375).
- If geometry cannot be determined from the email, set confidence to "low".
- If dimensions are partially available, extract what you can and set confidence to "medium".

{bom_context}

Respond ONLY with valid JSON (no markdown, no explanation):
{{
  "geometryType": "FLAT_BAR",
  "thickness": 2.5,
  "width": 6.0,
  "length": 120.0,
  "diameter": null,
  "outerDiameter": null,
  "innerDiameter": null,
  "quantity": 10,
  "scanIndex": null,
  "numberOfScans": 1,
  "confidence": "high",
  "notes": "any assumptions made"
}}"""

NEEDS_DIMENSIONS_MSG = (
    "Thank you for your quote request. To provide an accurate inspection quote, "
    "we need the following part dimensions:\n\n"
    "- Geometry type (flat bar, round bar, ring, tubing, etc.)\n"
    "- Relevant dimensions (thickness, width, length, diameter, OD/ID) in inches\n"
    "- Quantity of parts\n\n"
    "Please reply with these details and we will process your quote promptly."
)


# ── Fetch email quote + BOM history ──────────────────────────────────────────

async def fetch_email_quote(pool, email_quote_id: str) -> dict | None:
    row = await pool.fetchrow(
        """SELECT eq.id, eq.quote_number, eq.subject, eq.body_text,
                  eq.sender_email, eq.customer_id, eq.customer_name,
                  eq.inspection_types, eq.matched_part_number,
                  eq.matched_part_account, eq.matched_part_services,
                  eq.detected_part_numbers
           FROM app.email_quotes eq
           WHERE eq.id = $1::uuid""",
        email_quote_id,
    )
    return dict(row) if row else None


async def fetch_bom_history(pool, part_number: str, customer_id: str | None) -> dict | None:
    """Get historical job data for the matched part from sf.bom_parts."""
    if not part_number:
        return None
    row = await pool.fetchrow(
        """SELECT bp.part_number, bp.account_name, bp.services,
                  bp.specifications, bp.procedures,
                  bp.avg_invoice, bp.job_count
           FROM sf.bom_parts bp
           WHERE UPPER(bp.part_number) = UPPER($1)
           ORDER BY bp.job_count DESC
           LIMIT 1""",
        part_number,
    )
    return dict(row) if row else None


# ── LLM helpers ───────────────────────────────────────────────────────────────

LLM_MODEL = "anthropic/claude-haiku-4-5"

async def _get_llm_api_key() -> str:
    """Read OpenRouter API key from DB (same as gateway_server.get_llm_config)."""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT key, value FROM ut.app_settings WHERE key IN ('openrouter_api_key', 'llm_api_key')"
    )
    cfg = {r["key"]: r["value"] for r in rows}
    key = cfg.get("openrouter_api_key") or cfg.get("llm_api_key") or ""
    if not key:
        key = os.environ.get("OPENROUTER_API_KEY", "")
    return key


# ── LLM dimension extraction ─────────────────────────────────────────────────

async def extract_dimensions(email_text: str, bom_history: dict | None) -> dict:
    """Call Claude Haiku to extract geometry + dimensions from email text."""
    bom_context = ""
    if bom_history:
        bom_context = (
            f"CONTEXT FROM PREVIOUS JOBS FOR THIS PART ({bom_history['part_number']}):\n"
            f"- Customer: {bom_history['account_name']}\n"
            f"- Services used: {bom_history.get('services', [])}\n"
            f"- Specifications: {bom_history.get('specifications', [])}\n"
            f"- Total jobs: {bom_history.get('job_count', 0)}\n"
            f"- Avg invoice: ${bom_history.get('avg_invoice', 0):.2f}\n"
            f"Use this context to inform your extraction if the email references this part."
        )

    system_prompt = EXTRACTION_PROMPT.replace("{bom_context}", bom_context)
    api_key = await _get_llm_api_key()

    t0 = time.monotonic()
    try:
        response_data, input_tokens, output_tokens = await openrouter_provider.call(
            prompt=email_text,
            system_prompt=system_prompt,
            model=LLM_MODEL,
            api_key=api_key,
            max_tokens=512,
        )
        latency_ms = int((time.monotonic() - t0) * 1000)

        parsed = response_data.get("parsed", {})
        if "raw" in parsed and len(parsed) == 1:
            parsed = {"confidence": "low", "notes": "LLM returned non-JSON response"}

        parsed["_llm_meta"] = {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "latency_ms": latency_ms,
            "model": LLM_MODEL,
        }

        logger.info(
            "extract_dimensions: confidence=%s geometry=%s tokens=%s/%s latency=%dms",
            parsed.get("confidence"), parsed.get("geometryType"),
            input_tokens, output_tokens, latency_ms,
        )
        return parsed

    except Exception as e:
        logger.error("extract_dimensions LLM call failed: %s", e)
        return {"confidence": "low", "notes": f"LLM call failed: {e}"}


# ── Call UT calculator ────────────────────────────────────────────────────────

async def call_ut_calculator(
    customer_id: str | None,
    customer_name: str,
    extraction: dict,
    email_quote_id: str,
    part_number: str | None,
) -> dict:
    """POST to the API's UT quote endpoint and return the response."""
    geo = extraction.get("geometryType", "FLAT_BAR")

    item: dict = {
        "geometryType": geo,
        "quantity": extraction.get("quantity", 1),
    }

    # Map dimensions based on geometry type
    if geo in ("FLAT_BAR", "CSCAN_FLAT", "THIN_SHEET"):
        item["thickness"] = extraction.get("thickness")
        item["width"] = extraction.get("width")
        item["length"] = extraction.get("length")
    elif geo in ("ROUND_BAR", "CSCAN_ROUND"):
        item["diameter"] = extraction.get("diameter")
        item["length"] = extraction.get("length")
    elif geo == "RING":
        item["outerDiameter"] = extraction.get("outerDiameter")
        item["innerDiameter"] = extraction.get("innerDiameter")
        item["length"] = extraction.get("length")
    elif geo == "TUBING":
        item["diameter"] = extraction.get("diameter")
        item["length"] = extraction.get("length")
        if extraction.get("numberOfScans"):
            item["numberOfScans"] = extraction["numberOfScans"]

    if extraction.get("scanIndex"):
        item["scanIndex"] = extraction["scanIndex"]

    if part_number:
        item["partNumber"] = part_number

    payload = {
        "items": [item],
        "source": "email",
        "externalRef": str(email_quote_id),
    }
    if customer_id:
        payload["customerId"] = str(customer_id)
    else:
        payload["customerName"] = str(customer_name)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{API_URL}/quote",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "X-Internal-Secret": INTERNAL_SECRET,
            },
        )
        if not resp.is_success:
            error_body = resp.text[:500]
            raise RuntimeError(f"UT calculator returned {resp.status_code}: {error_body}")
        return resp.json()


# ── Send needs-info auto-reply via WF-7 ──────────────────────────────────────

async def send_needs_info(pool, email_quote_id: str, sender_email: str, subject: str, message: str):
    """Update status to needs_info, record outbound thread, trigger WF-7."""
    await pool.execute(
        "UPDATE app.email_quotes SET status='needs_info', updated_at=now() WHERE id=$1::uuid",
        email_quote_id,
    )
    await pool.execute(
        """INSERT INTO app.email_threads
             (email_quote_id, direction, subject, body_text,
              sender_email, recipient_email, triggered_by_check_code, sent_at)
           VALUES ($1::uuid, 'outbound', $2, $3, 'ndtautoquotes@gmail.com', $4, 'DIMENSIONS_NEEDED', now())""",
        email_quote_id, f"Re: {subject}", message, sender_email,
    )
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                N8N_REPLY_URL,
                json={
                    "to": os.environ.get("AUTO_REPLY_OVERRIDE") or sender_email,
                    "subject": subject,
                    "body": message,
                    "emailQuoteId": email_quote_id,
                    "checkCode": "DIMENSIONS_NEEDED",
                },
                headers={"Content-Type": "application/json"},
            )
    except Exception as e:
        logger.error("send_needs_info WF-7 trigger failed: %s", e)


# ── Update email_quote with result ────────────────────────────────────────────

async def update_quote_status(
    pool, email_quote_id: str, status: str,
    ut_quote_id: str | None = None,
    ut_quote_number: str | None = None,
    llm_extraction: dict | None = None,
    error: str | None = None,
):
    await pool.execute(
        """UPDATE app.email_quotes
           SET status = $1,
               ut_quote_id = $2::uuid,
               ut_quote_number = $3,
               llm_extraction = $4::jsonb,
               pipeline_error = $5,
               updated_at = now()
           WHERE id = $6::uuid""",
        status,
        ut_quote_id,
        ut_quote_number,
        json.dumps(llm_extraction) if llm_extraction else None,
        error,
        email_quote_id,
    )


# ── Store analysis record ─────────────────────────────────────────────────────

async def store_analysis(
    pool, email_quote_id: str, ut_quote_id: str | None,
    quote_number: str, inspection_type: str,
    extraction: dict,
):
    """Store in app.diagram_analyses for the Quote Analyses viewer."""
    try:
        await pool.execute(
            """INSERT INTO app.diagram_analyses
                 (email_quote_id, ut_quote_id, quote_type, quote_number,
                  inspection_type, step_name, raw_response, created_at)
               VALUES ($1::uuid, $2::uuid, 'email', $3, $4, 'dimension_extraction', $5::jsonb, now())""",
            email_quote_id, ut_quote_id, quote_number,
            inspection_type, json.dumps(extraction),
        )
    except Exception as e:
        logger.warning("store_analysis failed (non-fatal): %s", e)


# ── Main orchestrator ─────────────────────────────────────────────────────────

async def run_pipeline(email_quote_id: str, pipeline_type: str) -> dict:
    """Main entry point: fetch quote → extract dims → call UT calc → update status."""
    pool = await get_pool()

    # 1. Fetch email quote
    eq = await fetch_email_quote(pool, email_quote_id)
    if not eq:
        raise ValueError(f"Email quote not found: {email_quote_id}")

    inspection_types = eq.get("inspection_types") or []
    logger.info(
        "run_pipeline: %s types=%s customer=%s part=%s",
        eq["quote_number"], inspection_types, eq["customer_name"], eq.get("matched_part_number"),
    )

    # 2. Only handle UT for now (RT/MT/PT/ET/VT are future)
    if "UT" not in inspection_types:
        # Non-UT: leave at processing, log that we can't auto-quote yet
        msg = f"Auto-quoting not yet supported for inspection types: {inspection_types}"
        await update_quote_status(pool, email_quote_id, "processing", error=msg)
        return {"status": "processing", "emailQuoteId": email_quote_id, "error": msg}

    # 3. Fetch BOM history for context
    bom = await fetch_bom_history(pool, eq.get("matched_part_number"), eq.get("customer_id"))

    # 4. LLM extraction
    email_text = f"Subject: {eq['subject']}\n\n{eq['body_text'] or ''}"
    extraction = await extract_dimensions(email_text, bom)

    confidence = extraction.get("confidence", "low")
    geo = extraction.get("geometryType")

    # 5. Check if extraction is usable
    if confidence == "low" or not geo:
        logger.info("run_pipeline: low confidence extraction — requesting dimensions")
        await update_quote_status(
            pool, email_quote_id, "needs_info",
            llm_extraction=extraction,
        )
        await send_needs_info(
            pool, email_quote_id,
            eq["sender_email"], eq["subject"],
            NEEDS_DIMENSIONS_MSG,
        )
        return {
            "status": "needs_info",
            "emailQuoteId": email_quote_id,
            "error": "Could not extract dimensions — requested from sender",
        }

    # 6. Validate required dimensions are present
    required_dims = _check_required_dims(geo, extraction)
    if required_dims:
        logger.info("run_pipeline: missing dimensions %s — requesting", required_dims)
        await update_quote_status(
            pool, email_quote_id, "needs_info",
            llm_extraction=extraction,
            error=f"Missing dimensions: {required_dims}",
        )
        await send_needs_info(
            pool, email_quote_id,
            eq["sender_email"], eq["subject"],
            NEEDS_DIMENSIONS_MSG,
        )
        return {
            "status": "needs_info",
            "emailQuoteId": email_quote_id,
            "error": f"Missing dimensions: {required_dims}",
        }

    # 7. Call UT calculator
    try:
        result = await call_ut_calculator(
            customer_id=eq.get("customer_id"),
            customer_name=eq["customer_name"],
            extraction=extraction,
            email_quote_id=email_quote_id,
            part_number=eq.get("matched_part_number"),
        )
    except Exception as e:
        logger.error("run_pipeline: UT calculator failed: %s", e)
        await update_quote_status(
            pool, email_quote_id, "failed",
            llm_extraction=extraction,
            error=str(e),
        )
        return {"status": "failed", "emailQuoteId": email_quote_id, "error": str(e)}

    # 8. Extract quote ID and number from response
    ut_quote_id = result.get("quoteId")
    ut_quote_number = result.get("quoteNumber")

    # 9. Update email quote → quoted
    await update_quote_status(
        pool, email_quote_id, "quoted",
        ut_quote_id=ut_quote_id,
        ut_quote_number=ut_quote_number,
        llm_extraction=extraction,
    )

    # 10. Store analysis for viewer
    await store_analysis(
        pool, email_quote_id, ut_quote_id,
        eq["quote_number"], "UT", extraction,
    )

    logger.info(
        "run_pipeline: SUCCESS %s → %s (grand_total=%s)",
        eq["quote_number"], ut_quote_number, result.get("summary", {}).get("totalGrand"),
    )

    return {
        "status": "quoted",
        "emailQuoteId": email_quote_id,
        "utQuoteId": ut_quote_id,
        "utQuoteNumber": ut_quote_number,
    }


def _check_required_dims(geo: str, extraction: dict) -> list[str]:
    """Return list of missing required dimensions for the geometry type."""
    missing = []

    def check(field: str):
        val = extraction.get(field)
        if val is None or (isinstance(val, (int, float)) and val <= 0):
            missing.append(field)

    if geo in ("FLAT_BAR", "CSCAN_FLAT", "THIN_SHEET"):
        check("thickness"); check("width"); check("length")
    elif geo in ("ROUND_BAR", "CSCAN_ROUND"):
        check("diameter"); check("length")
    elif geo == "RING":
        check("outerDiameter"); check("innerDiameter"); check("length")
    elif geo == "TUBING":
        check("diameter"); check("length")

    return missing
