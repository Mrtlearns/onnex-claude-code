"""
PI Lawyer OS — AI Service
FastAPI service wrapping Claude API for document analysis and demand letter generation.
Port: 8002
"""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import anthropic
import jwt as pyjwt
import psycopg2
import psycopg2.extras
from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel

from extract import extract_image_b64, extract_text

app = FastAPI(title="PI Lawyer OS — AI Service")

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "stub")
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "pilaweros_internal_key_changeme")
JWT_SECRET = os.environ["JWT_SECRET"]
DB_URI = os.environ["DB_URI"]
DATA_DIR = os.environ.get("DATA_DIR", "/data")
MODEL = "claude-sonnet-4-6"

claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


# ── Auth ──────────────────────────────────────────────────────────────────────

def verify_jwt(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except pyjwt.PyJWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    if not payload.get("firm_id"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No firm_id in token")
    return payload


def verify_internal(x_internal_key: str | None = None, authorization: str | None = None) -> dict | None:
    """Accept either internal service key or JWT. Returns JWT claims if JWT, None if internal key."""
    if x_internal_key and x_internal_key == INTERNAL_API_KEY:
        return None  # Internal call — no claims, will use DB lookup
    if authorization:
        return verify_jwt(authorization)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")


# ── DB ────────────────────────────────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(DB_URI, cursor_factory=psycopg2.extras.RealDictCursor)


# ── Claude helpers ────────────────────────────────────────────────────────────

def claude_json(system: str, user: str, max_tokens: int = 1024) -> dict:
    """Call Claude and parse JSON response."""
    response = claude.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    raw = response.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(raw)


def claude_text(system: str, user: str, max_tokens: int = 2048) -> str:
    """Call Claude and return raw text response."""
    response = claude.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return response.content[0].text.strip()


def claude_vision_json(system: str, prompt: str, b64_data: str, media_type: str, max_tokens: int = 1024) -> dict:
    """Call Claude with an image and parse JSON response."""
    response = claude.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": media_type, "data": b64_data},
                },
                {"type": "text", "text": prompt},
            ],
        }],
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(raw)


# ── Prompts ───────────────────────────────────────────────────────────────────

MEDICAL_SYSTEM = (
    "You are a medical records analyst for a personal injury law firm. "
    "Extract structured information from medical records for case evaluation. "
    "Be precise. Only extract information explicitly stated in the document. "
    "Output valid JSON only."
)

CLASSIFY_SYSTEM = (
    "You are a legal document classifier for a personal injury law firm. "
    "Classify documents into one of the defined categories. "
    "Output valid JSON only."
)

DEMAND_SYSTEM = (
    "You are a legal writing assistant for a personal injury law firm. "
    "Draft professional demand letters based on case facts and medical records. "
    "Write in formal legal style appropriate for sending to insurance adjusters. "
    "Do not fabricate facts. Use only the information provided."
)

INTAKE_SYSTEM = (
    "You are an intake specialist assistant for a personal injury law firm. "
    "Your job is to extract and structure key information from intake notes or transcripts. "
    "Be concise and accurate. Do not invent information not present in the input. "
    "Output valid JSON only."
)


def build_medical_prompt(text: str) -> str:
    return f"""Extract the following from this medical record:

{text}

Return JSON:
{{
  "provider_name": "...",
  "provider_type": "emergency-room|urgent-care|chiropractor|orthopedic|physical-therapy|other",
  "dates_of_treatment": ["YYYY-MM-DD"],
  "diagnoses": ["..."],
  "injuries_described": "...",
  "treatment_provided": "...",
  "total_bill": 0.00,
  "lien_amount": 0.00,
  "notes": "..."
}}"""


def build_classify_prompt(text: str) -> str:
    return f"""Classify this document excerpt:

{text[:500]}

Return JSON:
{{
  "document_type": "retainer|medical-record|medical-bill|police-report|pleading|correspondence|settlement|insurance|other",
  "confidence": "high|medium|low",
  "notes": "brief reason for classification"
}}"""


def build_demand_prompt(
    case: dict,
    client: dict,
    medical_summaries: list[dict],
    providers: list[dict] | None = None,
    costs: list[dict] | None = None,
    offers: list[dict] | None = None,
) -> str:
    providers = providers or []
    costs = costs or []
    offers = offers or []

    # Medical providers table
    if providers:
        provider_lines = "\n".join(
            f"  • {p.get('provider_name','Unknown')} ({p.get('provider_type','')})"
            f" — Lien: ${float(p.get('lien_amount') or 0):,.2f}"
            f" | Request: {p.get('records_request_status','pending')}"
            for p in providers
        )
    else:
        provider_lines = "  No providers on file."

    # AI medical summaries
    if medical_summaries:
        med_summary_text = "\n".join(
            f"- {s.get('provider_name','Unknown')} ({s.get('provider_type','')}):\n"
            f"  Injuries: {s.get('injuries_described','')}\n"
            f"  Treatment: {s.get('treatment_provided','')}\n"
            f"  Bill: ${float(s.get('total_bill') or 0):,.2f}"
            for s in medical_summaries
        )
    else:
        med_summary_text = "No AI medical summaries available."

    medical_total = sum(float(s.get("total_bill") or 0) for s in medical_summaries)
    lien_total    = sum(float(p.get("lien_amount") or 0) for p in providers)
    case_costs_total = sum(float(c.get("amount") or 0) for c in costs)

    # Settlement history
    if offers:
        offer_lines = "\n".join(
            f"  {o.get('offer_date','')}: ${float(o.get('offer_amount') or 0):,.2f} ({o.get('offer_type','offer')})"
            for o in offers
        )
    else:
        offer_lines = "  No prior offers."

    demand_amount = max(medical_total * 3, medical_total + 10000)

    return f"""Draft a demand letter for the following case.

═══ CLIENT ═══════════════════════════════════════════════
Name:         {client.get('first_name','')} {client.get('last_name','')}
DOB:          {client.get('date_of_birth','Unknown')}
Address:      {client.get('address','')}, {client.get('city','')}, {client.get('state','')} {client.get('zip_code','')}
Insurance:    {client.get('insurance_carrier','Unknown Insurance Company')}
Policy #:     {client.get('policy_number','[TBD]')}
Adjuster:     {client.get('insurance_adjuster','Unknown Adjuster')}

═══ CASE ══════════════════════════════════════════════════
Case #:       {case.get('case_number','[TBD]')}
Incident:     {case.get('incident_type', case.get('case_type','auto'))}
Date of Loss: {case.get('date_of_loss','Unknown')}
Description:  {case.get('description','Not provided')}
SOL Date:     {case.get('sol_date','Unknown')}

═══ MEDICAL PROVIDERS ═════════════════════════════════════
{provider_lines}

Total Provider Liens: ${lien_total:,.2f}

═══ AI MEDICAL SUMMARIES ══════════════════════════════════
{med_summary_text}

Total Medical Specials: ${medical_total:,.2f}

═══ CASE COSTS ════════════════════════════════════════════
Case costs to date: ${case_costs_total:,.2f}

═══ SETTLEMENT HISTORY ════════════════════════════════════
{offer_lines}

═══ DEMAND CALCULATION ════════════════════════════════════
Medical specials:   ${medical_total:,.2f}
Pain & suffering:   ${medical_total * 2:,.2f}  (2× medicals)
Total demand:       ${demand_amount:,.2f}

Write a complete, professional demand letter suitable for attorney review and signature.

Structure:
1. Header: date, insurance company address, re: line with claimant name, DOB, DOL, claim number
2. Introduction: represent [client name], describe accident circumstances and liability briefly
3. Liability: explain why defendant/insured is liable
4. Injuries and Treatment: narrative using the AI medical summaries above, reference each provider
5. Medical Specials Table: list each provider with charges
6. Pain and Suffering: describe impact on daily life, use active language
7. Demand: state the demand amount of ${demand_amount:,.2f}, request response within 30 days
8. Closing: standard attorney signature block placeholder

Use formal legal letter style. Do not use placeholders where data is provided above — fill in the actual values."""


def build_intake_prompt(notes: str) -> str:
    return f"""Extract the following from this intake transcript or notes:
1. injury_description: one to two sentences describing the injury
2. liability_assessment: who appears to be at fault and why (brief)
3. next_steps: list of 2-3 recommended next steps for the intake team
4. case_type: one of [auto-accident, slip-fall, dog-bite, premises-liability, other]
5. urgency: one of [high, medium, low] based on injury severity and SOL proximity

Intake notes:
{notes}

Return JSON:
{{
  "injury_description": "...",
  "liability_assessment": "...",
  "next_steps": ["...", "...", "..."],
  "case_type": "...",
  "urgency": "..."
}}"""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Analyze document ──────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    document_id: str


@app.post("/analyze-document")
def analyze_document(req: AnalyzeRequest, authorization: str | None = Header(default=None)):
    claims = verify_jwt(authorization)
    firm_id = claims["firm_id"]

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Fetch document metadata
            cur.execute(
                "SELECT id, firm_id, file_path, name, mime_type, doc_type, case_id "
                "FROM documents WHERE id = %s",
                (req.document_id,)
            )
            doc = cur.fetchone()
            if not doc:
                raise HTTPException(status_code=404, detail="Document not found")
            if str(doc["firm_id"]) != str(firm_id):
                raise HTTPException(status_code=403, detail="Forbidden")

            # Check for existing analysis
            cur.execute(
                "SELECT id, status, analysis FROM ai_analyses WHERE document_id = %s",
                (req.document_id,)
            )
            existing = cur.fetchone()

            # Mark as processing
            analysis_id = str(existing["id"]) if existing else str(uuid.uuid4())
            if existing:
                cur.execute(
                    "UPDATE ai_analyses SET status = 'processing', updated_at = now() WHERE id = %s",
                    (analysis_id,)
                )
            else:
                cur.execute(
                    "INSERT INTO ai_analyses (id, firm_id, document_id, analysis, status) "
                    "VALUES (%s, %s, %s, %s, 'processing')",
                    (analysis_id, firm_id, req.document_id, json.dumps({}))
                )
            conn.commit()

        # Extract content
        file_path = f"{DATA_DIR}/{doc['file_path']}"
        image_result = extract_image_b64(file_path)

        try:
            if image_result:
                b64_data, media_type = image_result
                result = claude_vision_json(MEDICAL_SYSTEM, build_medical_prompt("[See image]"), b64_data, media_type)
            else:
                text = extract_text(file_path) or ""
                if not text.strip():
                    raise ValueError("No extractable text in document")
                result = claude_json(MEDICAL_SYSTEM, build_medical_prompt(text))

            # Store success
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE ai_analyses SET status = 'complete', analysis = %s, error_msg = NULL, updated_at = now() "
                    "WHERE id = %s",
                    (json.dumps(result), analysis_id)
                )
                conn.commit()

            return {"id": analysis_id, "document_id": req.document_id, "status": "complete", "analysis": result}

        except Exception as e:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE ai_analyses SET status = 'error', error_msg = %s, updated_at = now() WHERE id = %s",
                    (str(e), analysis_id)
                )
                conn.commit()
            raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")

    finally:
        conn.close()


# ── Classify document ─────────────────────────────────────────────────────────

class ClassifyRequest(BaseModel):
    document_id: str


@app.post("/classify-document")
def classify_document(req: ClassifyRequest, authorization: str | None = Header(default=None)):
    claims = verify_jwt(authorization)
    firm_id = claims["firm_id"]

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, firm_id, file_path FROM documents WHERE id = %s",
                (req.document_id,)
            )
            doc = cur.fetchone()
            if not doc:
                raise HTTPException(status_code=404, detail="Document not found")
            if str(doc["firm_id"]) != str(firm_id):
                raise HTTPException(status_code=403, detail="Forbidden")

        file_path = f"{DATA_DIR}/{doc['file_path']}"
        image_result = extract_image_b64(file_path)

        if image_result:
            b64_data, media_type = image_result
            result = claude_vision_json(CLASSIFY_SYSTEM, build_classify_prompt("[See image]"), b64_data, media_type)
        else:
            text = extract_text(file_path) or ""
            result = claude_json(CLASSIFY_SYSTEM, build_classify_prompt(text))

        # Update doc_type in documents table
        doc_type_map = {
            "medical-record": "medical", "medical-bill": "medical",
            "retainer": "retainer", "pleading": "pleading",
            "correspondence": "correspondence", "settlement": "settlement",
        }
        mapped = doc_type_map.get(result.get("document_type", ""), "other")

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE documents SET doc_type = %s, updated_at = now() WHERE id = %s",
                (mapped, req.document_id)
            )
            conn.commit()

        return {"document_id": req.document_id, "classification": result, "doc_type_updated": mapped}

    finally:
        conn.close()


# ── Get analysis ──────────────────────────────────────────────────────────────

@app.get("/analysis/{document_id}")
def get_analysis(document_id: str, authorization: str | None = Header(default=None)):
    claims = verify_jwt(authorization)
    firm_id = claims["firm_id"]

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT a.id, a.document_id, a.status, a.analysis, a.error_msg, a.created_at, a.updated_at "
                "FROM ai_analyses a "
                "JOIN documents d ON d.id = a.document_id "
                "WHERE a.document_id = %s AND d.firm_id = %s",
                (document_id, firm_id)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="No analysis found")
            return dict(row)
    finally:
        conn.close()


# ── Generate demand letter ────────────────────────────────────────────────────

@app.post("/generate-demand/{case_id}")
def generate_demand(case_id: str, authorization: str | None = Header(default=None)):
    claims = verify_jwt(authorization)
    firm_id = claims["firm_id"]

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Fetch case
            cur.execute(
                "SELECT * FROM cases WHERE id = %s AND firm_id = %s",
                (case_id, firm_id)
            )
            case = cur.fetchone()
            if not case:
                raise HTTPException(status_code=404, detail="Case not found")

            # Fetch client
            client: dict[str, Any] = {}
            if case["client_id"]:
                cur.execute("SELECT * FROM clients WHERE id = %s", (case["client_id"],))
                row = cur.fetchone()
                if row:
                    client = dict(row)

            # Fetch all medical analyses for this case
            cur.execute(
                "SELECT a.analysis FROM ai_analyses a "
                "JOIN documents d ON d.id = a.document_id "
                "WHERE d.case_id = %s AND a.status = 'complete' AND d.firm_id = %s",
                (case_id, firm_id)
            )
            summaries = [row["analysis"] for row in cur.fetchall() if row["analysis"]]

            # Fetch medical providers + lien amounts + records request status
            cur.execute(
                "SELECT provider_name, provider_type, lien_amount, records_request_status "
                "FROM medical_providers WHERE case_id = %s AND firm_id = %s ORDER BY created_at",
                (case_id, firm_id)
            )
            providers = [dict(r) for r in cur.fetchall()]

            # Fetch case costs
            cur.execute(
                "SELECT description, amount FROM case_costs WHERE case_id = %s AND firm_id = %s ORDER BY created_at",
                (case_id, firm_id)
            )
            costs = [dict(r) for r in cur.fetchall()]

            # Fetch settlement offer history
            cur.execute(
                "SELECT offer_amount, offer_type, offer_date FROM settlement_offers "
                "WHERE case_id = %s AND firm_id = %s ORDER BY offer_date",
                (case_id, firm_id)
            )
            offers = [dict(r) for r in cur.fetchall()]

        # Generate via Claude
        prompt = build_demand_prompt(dict(case), client, summaries, providers, costs, offers)
        letter_text = claude_text(DEMAND_SYSTEM, prompt, max_tokens=2048)

        # Upsert demand letter
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM demand_letters WHERE case_id = %s AND firm_id = %s",
                (case_id, firm_id)
            )
            existing = cur.fetchone()
            if existing:
                cur.execute(
                    "UPDATE demand_letters SET content = %s, generated_at = now(), updated_at = now() "
                    "WHERE id = %s RETURNING id",
                    (letter_text, existing["id"])
                )
                letter_id = existing["id"]
            else:
                letter_id = str(uuid.uuid4())
                cur.execute(
                    "INSERT INTO demand_letters (id, firm_id, case_id, content) VALUES (%s, %s, %s, %s)",
                    (letter_id, firm_id, case_id, letter_text)
                )
            conn.commit()

        return {"id": letter_id, "case_id": case_id, "content": letter_text}

    finally:
        conn.close()


# ── Get demand letter ─────────────────────────────────────────────────────────

@app.get("/demand/{case_id}")
def get_demand(case_id: str, authorization: str | None = Header(default=None)):
    claims = verify_jwt(authorization)
    firm_id = claims["firm_id"]

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, case_id, content, generated_at, updated_at "
                "FROM demand_letters WHERE case_id = %s AND firm_id = %s",
                (case_id, firm_id)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="No demand letter found")
            return dict(row)
    finally:
        conn.close()


# ── Update demand letter (for inline editing) ──────────────────────────────────

class UpdateDemandRequest(BaseModel):
    content: str


@app.patch("/demand/{case_id}")
def update_demand(case_id: str, req: UpdateDemandRequest, authorization: str | None = Header(default=None)):
    claims = verify_jwt(authorization)
    firm_id = claims["firm_id"]

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE demand_letters SET content = %s, updated_at = now() "
                "WHERE case_id = %s AND firm_id = %s RETURNING id",
                (req.content, case_id, firm_id)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="No demand letter found")
            conn.commit()
        return {"id": row["id"], "case_id": case_id, "content": req.content}
    finally:
        conn.close()


# ── Intake summary ────────────────────────────────────────────────────────────

class IntakeSummaryRequest(BaseModel):
    notes: str
    lead_id: str | None = None


@app.post("/intake-summary")
def intake_summary(req: IntakeSummaryRequest, authorization: str | None = Header(default=None)):
    verify_jwt(authorization)

    if not req.notes.strip():
        raise HTTPException(status_code=400, detail="Notes are required")

    result = claude_json(INTAKE_SYSTEM, build_intake_prompt(req.notes))
    return result


# ── Lead scoring ───────────────────────────────────────────────────────────────

SCORE_SYSTEM = (
    "You are a lead quality analyst for a personal injury law firm. "
    "Score leads 0–100 based on case quality and likelihood to retain. "
    "High scores (70+): clear liability, documented injury, responsive client, good source. "
    "Low scores (<40): unclear fault, minor injury, unresponsive, cold source. "
    "Output valid JSON only."
)


def build_score_prompt(lead: dict) -> str:
    return f"""Score this PI lead 0–100 for case quality and retention likelihood.

Lead data:
- Name: {lead.get('first_name', '')} {lead.get('last_name', '')}
- Injury Type: {lead.get('injury_type', 'unknown')}
- Source: {lead.get('source', 'unknown')}
- Phone: {'provided' if lead.get('phone') else 'missing'}
- Email: {'provided' if lead.get('email') else 'missing'}
- Notes: {(lead.get('notes') or 'none')[:300]}

Scoring factors:
- Injury severity and type (auto accident > slip-fall > other)
- Source quality (referral > web-form > google > phone > review > sms)
- Contact info completeness
- Notes clarity and urgency indicators

Return JSON:
{{
  "score": <integer 0-100>,
  "reason": "<one sentence explaining the score>"
}}"""


class ScoreLeadRequest(BaseModel):
    lead_id: str


@app.post("/score-lead")
def score_lead(
    req: ScoreLeadRequest,
    authorization: str | None = Header(default=None),
    x_internal_key: str | None = Header(default=None),
):
    verify_internal(x_internal_key, authorization)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, firm_id, first_name, last_name, phone, email, injury_type, source, notes "
                "FROM leads WHERE id = %s",
                (req.lead_id,)
            )
            lead = cur.fetchone()
            if not lead:
                raise HTTPException(status_code=404, detail="Lead not found")

            firm_id = str(lead["firm_id"])

            # Check for duplicates
            cur.execute(
                "SELECT check_lead_duplicate(%s, %s, %s, %s, %s)",
                (lead["phone"], lead["first_name"], lead["last_name"], firm_id, req.lead_id)
            )
            dup_row = cur.fetchone()
            dup_id = list(dup_row.values())[0] if dup_row else None

        # Score via Claude (or stub if API key is empty/placeholder)
        api_key = ANTHROPIC_API_KEY
        if not api_key or api_key in ("stub", "your-key-here", ""):
            score, reason = 75, "stub mode — no API key configured"
        else:
            try:
                result = claude_json(SCORE_SYSTEM, build_score_prompt(dict(lead)))
                score = max(0, min(100, int(result.get("score", 50))))
                reason = str(result.get("reason", ""))[:500]
            except Exception:
                score, reason = 50, "scoring unavailable"

        # Update lead with score + duplicate flag
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE leads SET lead_score = %s, lead_score_reason = %s, "
                "is_duplicate = %s, duplicate_of_lead_id = %s, updated_at = now() "
                "WHERE id = %s",
                (score, reason, dup_id is not None, str(dup_id) if dup_id else None, req.lead_id)
            )
            conn.commit()

        return {
            "lead_id": req.lead_id,
            "score": score,
            "reason": reason,
            "is_duplicate": dup_id is not None,
            "duplicate_of_lead_id": str(dup_id) if dup_id else None,
        }

    finally:
        conn.close()


# ── Case embeddings ────────────────────────────────────────────────────────────

def _stub_embedding() -> list[float]:
    """Deterministic stub embedding — cosine similarity works, returns results."""
    return [0.1] * 1536


def _build_case_text(case: dict, client: dict, providers: list[dict], settlement: dict | None) -> str:
    providers_text = "; ".join(
        f"{p.get('provider_name', 'Unknown')} ({p.get('provider_type', '')})"
        for p in providers
    ) or "none"
    settlement_text = f"${settlement['gross_settlement']:,.0f}" if settlement else "no settlement"
    return (
        f"Case type: {case.get('case_type', 'unknown')}. "
        f"Description: {(case.get('description') or 'none')[:300]}. "
        f"Medical providers: {providers_text}. "
        f"Settlement: {settlement_text}. "
        f"Client: {client.get('first_name', '')} {client.get('last_name', '')}."
    )


@app.post("/embed-case")
def embed_case(
    case_id: str,
    authorization: str | None = Header(default=None),
    x_internal_key: str | None = Header(default=None),
):
    verify_internal(x_internal_key, authorization)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM cases WHERE id = %s", (case_id,))
            case = cur.fetchone()
            if not case:
                raise HTTPException(status_code=404, detail="Case not found")

            client: dict = {}
            if case["client_id"]:
                cur.execute("SELECT * FROM clients WHERE id = %s", (case["client_id"],))
                row = cur.fetchone()
                if row:
                    client = dict(row)

            cur.execute(
                "SELECT name AS provider_name, provider_type FROM medical_providers WHERE case_id = %s",
                (case_id,)
            )
            providers = [dict(r) for r in cur.fetchall()]

            cur.execute(
                "SELECT gross_settlement FROM case_settlements WHERE case_id = %s LIMIT 1",
                (case_id,)
            )
            settlement_row = cur.fetchone()
            settlement = dict(settlement_row) if settlement_row else None

        case_text = _build_case_text(dict(case), client, providers, settlement)

        # Stub embedding (real OpenRouter call when OPENROUTER_API_KEY is set)
        embedding = _stub_embedding()

        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO case_embeddings (case_id, firm_id, embedding) "
                "VALUES (%s, %s, %s) "
                "ON CONFLICT (case_id) DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = now()",
                (case_id, str(case["firm_id"]), embedding)
            )
            conn.commit()

        return {"case_id": case_id, "embedded": True, "text_length": len(case_text)}

    finally:
        conn.close()


@app.get("/similar-cases/{case_id}")
def similar_cases(
    case_id: str,
    authorization: str | None = Header(default=None),
    x_internal_key: str | None = Header(default=None),
):
    verify_internal(x_internal_key, authorization)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT firm_id, case_type, description FROM cases WHERE id = %s", (case_id,))
            case = cur.fetchone()
            if not case:
                raise HTTPException(status_code=404, detail="Case not found")

            # Use stub query embedding
            query_embedding = _stub_embedding()

            # Cosine similarity search (pgvector <=> operator = cosine distance)
            cur.execute(
                """
                SELECT
                  ce.case_id,
                  1 - (ce.embedding <=> %s::vector) AS similarity,
                  c.case_number,
                  c.case_type,
                  c.status,
                  cs.gross_settlement
                FROM case_embeddings ce
                JOIN cases c ON c.id = ce.case_id
                LEFT JOIN case_settlements cs ON cs.case_id = ce.case_id
                WHERE ce.firm_id = %s
                  AND ce.case_id != %s
                ORDER BY ce.embedding <=> %s::vector
                LIMIT 3
                """,
                (query_embedding, str(case["firm_id"]), case_id, query_embedding)
            )
            rows = cur.fetchall()

        results = []
        for row in rows:
            results.append({
                "case_id": str(row["case_id"]),
                "case_number": row["case_number"],
                "case_type": row["case_type"],
                "status": row["status"],
                "similarity_pct": round(float(row["similarity"]) * 100, 1),
                "gross_settlement": float(row["gross_settlement"]) if row["gross_settlement"] else None,
            })

        return {"case_id": case_id, "similar": results}

    finally:
        conn.close()


# ── Document RAG (Phase 11) ────────────────────────────────────────────────

def _get_embedding(text: str) -> list[float]:
    """Get embedding vector for text. Stubs when OpenRouter key is 'stub'."""
    if OPENROUTER_API_KEY == "stub":
        return _stub_embedding()
    import urllib.request as _ureq
    payload = json.dumps({
        "model": "text-embedding-3-small",
        "input": text[:8000],
    }).encode()
    req = _ureq.Request(
        "https://openrouter.ai/api/v1/embeddings",
        data=payload,
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        },
    )
    with _ureq.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    return data["data"][0]["embedding"]


def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into overlapping word-based chunks."""
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunk = " ".join(words[i: i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
        i += chunk_size - overlap
    return chunks or [text[:2000]]


@app.post("/embed-document")
def embed_document(
    document_id: str,
    x_internal_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
):
    """
    Chunk and embed a document. Stores chunks in document_chunks table.
    Called by files service after upload (fire-and-forget).
    """
    claims = verify_internal(x_internal_key, authorization)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Fetch document record
            if claims:
                firm_id = claims["firm_id"]
                cur.execute(
                    "SELECT id, file_path, doc_type, firm_id FROM documents WHERE id = %s AND firm_id = %s",
                    (document_id, firm_id),
                )
            else:
                cur.execute(
                    "SELECT id, file_path, doc_type, firm_id FROM documents WHERE id = %s",
                    (document_id,),
                )
            doc = cur.fetchone()

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        firm_id = str(doc["firm_id"])

        # Extract text from file
        file_path = os.path.join(DATA_DIR, doc["file_path"].lstrip("/"))
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")

        text = extract_text(file_path)
        if not text or not text.strip():
            return {"document_id": document_id, "chunks": 0, "status": "no_text"}

        # Delete existing chunks for this document
        with conn.cursor() as cur:
            cur.execute("DELETE FROM document_chunks WHERE document_id = %s", (document_id,))

        # Chunk and embed
        chunks = _chunk_text(text)
        with conn.cursor() as cur:
            for idx, chunk in enumerate(chunks):
                embedding = _get_embedding(chunk)
                cur.execute(
                    """
                    INSERT INTO document_chunks (document_id, firm_id, chunk_index, content, embedding)
                    VALUES (%s, %s, %s, %s, %s::vector)
                    """,
                    (document_id, firm_id, idx, chunk, str(embedding)),
                )
        conn.commit()
        return {"document_id": document_id, "chunks": len(chunks), "status": "ok"}

    except HTTPException:
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        conn.close()


class SearchDocumentsRequest(BaseModel):
    query: str
    case_id: str | None = None
    limit: int = 5


@app.post("/search-documents")
def search_documents(
    req: SearchDocumentsRequest,
    authorization: str | None = Header(default=None),
):
    """
    Semantic search across embedded document chunks.
    Returns top-N chunks with document metadata.
    """
    claims = verify_jwt(authorization)
    firm_id = claims["firm_id"]

    query_embedding = _get_embedding(req.query)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if req.case_id:
                cur.execute(
                    """
                    SELECT dc.id, dc.chunk_index, dc.content,
                           d.id AS document_id, d.name AS file_name, d.doc_type, d.case_id,
                           1 - (dc.embedding <=> %s::vector) AS similarity
                    FROM document_chunks dc
                    JOIN documents d ON d.id = dc.document_id
                    WHERE dc.firm_id = %s AND d.case_id = %s
                    ORDER BY dc.embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (str(query_embedding), firm_id, req.case_id, str(query_embedding), req.limit),
                )
            else:
                cur.execute(
                    """
                    SELECT dc.id, dc.chunk_index, dc.content,
                           d.id AS document_id, d.name AS file_name, d.doc_type, d.case_id,
                           1 - (dc.embedding <=> %s::vector) AS similarity
                    FROM document_chunks dc
                    JOIN documents d ON d.id = dc.document_id
                    WHERE dc.firm_id = %s
                    ORDER BY dc.embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (str(query_embedding), firm_id, str(query_embedding), req.limit),
                )
            rows = cur.fetchall()

        return {
            "query": req.query,
            "results": [
                {
                    "chunk_id": str(r["id"]),
                    "document_id": str(r["document_id"]),
                    "file_name": r["file_name"],
                    "doc_type": r["doc_type"],
                    "case_id": str(r["case_id"]) if r["case_id"] else None,
                    "chunk_index": r["chunk_index"],
                    "content": r["content"],
                    "similarity_pct": round(float(r["similarity"]) * 100, 1),
                }
                for r in rows
            ],
        }
    finally:
        conn.close()
