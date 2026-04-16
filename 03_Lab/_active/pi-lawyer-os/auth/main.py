"""
PI Lawyer OS — Auth Service
Minimal JWT issuer for PostgREST authentication.
POST /auth/login              → returns JWT with firm_id + role claims (staff)
GET  /auth/me                 → returns current user info
GET  /auth/health             → liveness probe
POST /auth/portal-login       → returns JWT for client portal (client_user role)
POST /auth/portal-register    → staff creates a portal account for a client
GET  /auth/llm-settings       → get LLM config for current firm
PUT  /auth/llm-settings       → update LLM config + write openclaw.json
POST /auth/test-integration   → test connectivity for a configured integration
"""

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import bcrypt as bcrypt_lib
import httpx
import jwt
import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

# ── Config ──────────────────────────────────────────────────

JWT_SECRET = os.environ["JWT_SECRET"]
DB_URI = os.environ["DB_URI"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 12

# Path to openclaw config — bind-mounted from ./openclaw/config on the host
OPENCLAW_CONFIG_PATH = Path(os.environ.get("OPENCLAW_CONFIG_PATH", "/openclaw-config/openclaw.json"))
OPENCLAW_GATEWAY_TOKEN = os.environ.get("OPENCLAW_GATEWAY_TOKEN", "")

# LLM provider → OpenClaw model string
PROVIDER_MODEL_MAP = {
    ("openrouter", "auto"):          "openrouter/auto",
    ("openrouter", "gpt-4o"):        "openrouter/openai/gpt-4o",
    ("openrouter", "claude-sonnet"): "openrouter/anthropic/claude-sonnet-4-5",
    ("openrouter", "gemini-pro"):    "openrouter/google/gemini-pro-1.5",
    ("anthropic",  "claude-sonnet"): "anthropic/claude-sonnet-4-6",
    ("anthropic",  "claude-haiku"):  "anthropic/claude-haiku-4-5-20251001",
}

def _openclaw_model_string(provider: str, model: str) -> str:
    return PROVIDER_MODEL_MAP.get((provider, model), f"{provider}/{model}")

# ── App ──────────────────────────────────────────────────────

app = FastAPI(title="PI Lawyer OS Auth", root_path="/auth")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # tighten per-client in production
    allow_methods=["*"],
    allow_headers=["*"],
)

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt_lib.checkpw(plain.encode(), hashed.encode())

bearer = HTTPBearer()

# ── DB helper ────────────────────────────────────────────────

def get_db():
    conn = psycopg2.connect(DB_URI, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()

# ── Models ───────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: dict
    firm: dict

class PortalLoginRequest(BaseModel):
    firm_slug: str
    email: str
    password: str

class PortalLoginResponse(BaseModel):
    token: str
    client_id: str
    case_id: Optional[str]

class PortalRegisterRequest(BaseModel):
    client_id: str
    email: str
    password: str

class LlmSettingsRequest(BaseModel):
    llm_provider: str
    llm_model: str

class IntakeLeadRequest(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: Optional[str] = None
    injury_type: Optional[str] = None
    date_of_loss: Optional[str] = None   # ISO date string e.g. "2026-01-15"
    fault: Optional[str] = None          # 'yes' | 'no' | 'unsure'
    has_medical: Optional[bool] = None
    notes: Optional[str] = None
    source: str = "web-form"

class CreateUserRequest(BaseModel):
    email: str
    name: str
    role: str = "paralegal"   # admin | attorney | paralegal
    password: str

class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    password: Optional[str] = None

# ── JWT helpers ──────────────────────────────────────────────

def create_token(user_id: str, firm_id: str, role: str, email: str) -> str:
    """
    PostgREST expects:
      role  — maps to Postgres role (web_user)
      firm_id — used by RLS policy current_firm_id()
    """
    payload = {
        "sub": user_id,
        "role": "web_user",           # PostgREST switches to this role
        "firm_id": firm_id,           # picked up by current_firm_id() in Postgres
        "user_role": role,            # attorney / paralegal / admin (app-level)
        "email": email,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_portal_token(client_user_id: str, firm_id: str, client_id: str) -> str:
    """
    Portal JWT for client_user role.
    PostgREST maps role=client_user → restricted RLS policies.
    current_client_id() reads client_id from claims.
    """
    payload = {
        "sub": client_user_id,
        "role": "client_user",
        "firm_id": firm_id,
        "client_id": client_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
):
    return decode_token(creds.credentials)

# ── Routes ───────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT u.id, u.firm_id, u.email, u.name, u.role, u.password_hash,
                   u.active,
                   f.id AS f_id, f.name AS f_name, f.slug AS f_slug,
                   f.logo_url, f.primary_color, f.sms_signature
            FROM users u
            JOIN firms f ON f.id = u.firm_id
            WHERE u.email = %s
            """,
            (body.email,),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not row["active"]:
        raise HTTPException(status_code=403, detail="Account deactivated")

    if not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(
        user_id=str(row["id"]),
        firm_id=str(row["firm_id"]),
        role=row["role"],
        email=row["email"],
    )

    return LoginResponse(
        token=token,
        user={
            "id": str(row["id"]),
            "email": row["email"],
            "name": row["name"],
            "role": row["role"],
            "firm_id": str(row["firm_id"]),
        },
        firm={
            "id": str(row["f_id"]),
            "name": row["f_name"],
            "slug": row["f_slug"],
            "logo_url": row.get("logo_url"),
            "primary_color": row.get("primary_color") or "#0ea5e9",
            "sms_signature": row.get("sms_signature") or "— Your Legal Team",
        },
    )


@app.post("/portal-login", response_model=PortalLoginResponse)
def portal_login(body: PortalLoginRequest, conn=Depends(get_db)):
    """Client portal login. Returns JWT with role=client_user."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT cu.id, cu.firm_id, cu.client_id, cu.password_hash, cu.active
            FROM client_users cu
            JOIN firms f ON f.id = cu.firm_id
            WHERE f.slug = %s AND cu.email = %s
            """,
            (body.firm_slug, body.email),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not row["active"]:
        raise HTTPException(status_code=403, detail="Portal account disabled")

    if not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Find the client's case
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM cases WHERE client_id = %s AND firm_id = %s LIMIT 1",
            (str(row["client_id"]), str(row["firm_id"])),
        )
        case_row = cur.fetchone()

    token = create_portal_token(
        client_user_id=str(row["id"]),
        firm_id=str(row["firm_id"]),
        client_id=str(row["client_id"]),
    )
    return PortalLoginResponse(
        token=token,
        client_id=str(row["client_id"]),
        case_id=str(case_row["id"]) if case_row else None,
    )


@app.post("/portal-register", status_code=201)
def portal_register(
    body: PortalRegisterRequest,
    claims: dict = Depends(current_user),
    conn=Depends(get_db),
):
    """Staff endpoint: create a portal account for a client (requires staff JWT)."""
    firm_id = claims.get("firm_id")
    if not firm_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Verify client belongs to this firm
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM clients WHERE id = %s AND firm_id = %s",
            (body.client_id, firm_id),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Client not found")

    pw_hash = bcrypt_lib.hashpw(body.password.encode(), bcrypt_lib.gensalt()).decode()

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO client_users (firm_id, client_id, email, password_hash)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (firm_id, body.client_id, body.email, pw_hash),
            )
            result = cur.fetchone()
            conn.commit()
    except Exception as e:
        conn.rollback()
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Email already registered for this firm")
        raise HTTPException(status_code=500, detail="Failed to create portal account")

    return {"id": str(result["id"]), "email": body.email, "client_id": body.client_id}


@app.get("/me")
def me(claims: dict = Depends(current_user), conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT u.id, u.email, u.name, u.role, u.firm_id,
                   f.name AS firm_name, f.slug AS firm_slug
            FROM users u
            JOIN firms f ON f.id = u.firm_id
            WHERE u.id = %s
            """,
            (claims["sub"],),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": str(row["id"]),
        "email": row["email"],
        "name": row["name"],
        "role": row["role"],
        "firm_id": str(row["firm_id"]),
        "firm_name": row["firm_name"],
        "firm_slug": row["firm_slug"],
    }


@app.get("/openclaw-token")
def openclaw_token(claims: dict = Depends(current_user)):
    """Return the OpenClaw gateway token for authenticated staff (used by frontend iframe)."""
    if not claims.get("firm_id"):
        raise HTTPException(status_code=403, detail="Not authorized")
    if not OPENCLAW_GATEWAY_TOKEN:
        raise HTTPException(status_code=503, detail="OPENCLAW_GATEWAY_TOKEN not configured")
    return {"token": OPENCLAW_GATEWAY_TOKEN}


@app.get("/llm-settings")
def get_llm_settings(claims: dict = Depends(current_user), conn=Depends(get_db)):
    """Return the current LLM config for the caller's firm. Creates defaults if not set."""
    firm_id = claims.get("firm_id")
    if not firm_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    with conn.cursor() as cur:
        cur.execute(
            "SELECT llm_provider, llm_model FROM firm_settings WHERE firm_id = %s",
            (firm_id,),
        )
        row = cur.fetchone()

    if not row:
        # Seed defaults on first read
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO firm_settings (firm_id, llm_provider, llm_model)
                VALUES (%s, 'openrouter', 'auto')
                ON CONFLICT DO NOTHING
                RETURNING llm_provider, llm_model
                """,
                (firm_id,),
            )
            row = cur.fetchone() or {"llm_provider": "openrouter", "llm_model": "auto"}
            conn.commit()

    return {"llm_provider": row["llm_provider"], "llm_model": row["llm_model"]}


@app.put("/llm-settings")
def put_llm_settings(
    body: LlmSettingsRequest,
    claims: dict = Depends(current_user),
    conn=Depends(get_db),
):
    """Update LLM config for the firm and rewrite openclaw.json if accessible."""
    firm_id = claims.get("firm_id")
    if not firm_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO firm_settings (firm_id, llm_provider, llm_model)
            VALUES (%s, %s, %s)
            ON CONFLICT (firm_id) DO UPDATE
              SET llm_provider = EXCLUDED.llm_provider,
                  llm_model    = EXCLUDED.llm_model,
                  updated_at   = now()
            """,
            (firm_id, body.llm_provider, body.llm_model),
        )
        conn.commit()

    # Rewrite openclaw.json with updated model
    config_written = False
    model_string = _openclaw_model_string(body.llm_provider, body.llm_model)
    try:
        config = {
            "gateway": {
                "bind": "lan",
                "port": 47823,
                "auth": {"mode": "token"},
            },
            "agents": {
                "defaults": {
                    "workspace": "/workspace",
                    "model": {
                        "primary": model_string,
                        "fallbacks": ["anthropic/claude-sonnet-4-6"],
                    },
                    "thinkingDefault": "low",
                    "timeoutSeconds": 600,
                },
                "list": [
                    {
                        "id": "wyatt",
                        "default": True,
                        "name": "Wyatt",
                        "workspace": "/workspace",
                        "model": {
                            "primary": model_string,
                            "fallbacks": ["anthropic/claude-sonnet-4-6"],
                        },
                        "identity": {
                            "name": "Wyatt",
                            "theme": "sharp PI law firm operations assistant",
                            "emoji": "⚖️",
                        },
                    }
                ],
            },
            "logging": {"level": "info"},
        }
        OPENCLAW_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        OPENCLAW_CONFIG_PATH.write_text(json.dumps(config, indent=2, ensure_ascii=False))
        config_written = True
    except Exception as exc:
        # Non-fatal: DB was updated, config write failed (e.g. volume not mounted)
        config_written = False

    return {
        "llm_provider": body.llm_provider,
        "llm_model": body.llm_model,
        "openclaw_model": model_string,
        "config_written": config_written,
        "restart_required": config_written,
    }


@app.post("/intake", status_code=201)
def public_intake(body: IntakeLeadRequest, conn=Depends(get_db)):
    """
    Public endpoint — no auth required.
    Creates a lead for the deployed firm (single-tenant; uses first firm found).
    Used by the unauthenticated web intake form at /intake.
    """
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM firms LIMIT 1")
        firm = cur.fetchone()

    if not firm:
        raise HTTPException(status_code=500, detail="Firm not configured")

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO leads
                  (firm_id, first_name, last_name, phone, email,
                   injury_type, date_of_loss, fault, has_medical, notes, source, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'new')
                RETURNING id
                """,
                (
                    str(firm["id"]),
                    body.first_name,
                    body.last_name,
                    body.phone,
                    body.email,
                    body.injury_type,
                    body.date_of_loss,
                    body.fault,
                    body.has_medical,
                    body.notes,
                    body.source,
                ),
            )
            row = cur.fetchone()
            conn.commit()
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to submit intake form")

    return {"id": str(row["id"]), "status": "received"}


def require_admin(claims: dict = Depends(current_user)):
    if claims.get("user_role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return claims


@app.post("/create-user", status_code=201)
def create_user(body: CreateUserRequest, claims: dict = Depends(require_admin), conn=Depends(get_db)):
    """Admin-only: create a new staff user for the current firm."""
    hashed = bcrypt_lib.hashpw(body.password.encode(), bcrypt_lib.gensalt()).decode()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (firm_id, email, name, role, password_hash, active)
                VALUES (%s, %s, %s, %s, %s, true)
                RETURNING id, email, name, role, active
                """,
                (claims["firm_id"], body.email, body.name, body.role, hashed),
            )
            row = cur.fetchone()
            conn.commit()
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=409, detail="Email already in use or invalid data")
    return {"id": str(row["id"]), "email": row["email"], "name": row["name"], "role": row["role"], "active": row["active"]}


@app.patch("/update-user/{user_id}")
def update_user(user_id: str, body: UpdateUserRequest, claims: dict = Depends(require_admin), conn=Depends(get_db)):
    """Admin-only: update name, role, active status, or password for a staff user."""
    sets, params = [], []
    if body.name is not None:
        sets.append("name = %s"); params.append(body.name)
    if body.role is not None:
        sets.append("role = %s"); params.append(body.role)
    if body.active is not None:
        sets.append("active = %s"); params.append(body.active)
    if body.password is not None:
        hashed = bcrypt_lib.hashpw(body.password.encode(), bcrypt_lib.gensalt()).decode()
        sets.append("password_hash = %s"); params.append(hashed)
    if not sets:
        raise HTTPException(status_code=400, detail="Nothing to update")
    params.extend([user_id, claims["firm_id"]])
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE users SET {', '.join(sets)} WHERE id = %s AND firm_id = %s RETURNING id, email, name, role, active",
            params,
        )
        row = cur.fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": str(row["id"]), "email": row["email"], "name": row["name"], "role": row["role"], "active": row["active"]}


@app.get("/list-users")
def list_users(claims: dict = Depends(require_admin), conn=Depends(get_db)):
    """Admin-only: list all staff users for the current firm."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, email, name, role, active, created_at FROM users WHERE firm_id = %s ORDER BY created_at",
            (claims["firm_id"],),
        )
        rows = cur.fetchall()
    return [{"id": str(r["id"]), "email": r["email"], "name": r["name"], "role": r["role"], "active": r["active"]} for r in rows]


# ── Integration test ──────────────────────────────────────────

class TestIntegrationRequest(BaseModel):
    integration: str
    credentials: Dict[str, str]


# Integrations that use OAuth flows — just validate fields are present
OAUTH_ONLY = {"docusign", "quickbooks", "clio", "mycase", "ringcentral"}


@app.post("/test-integration")
async def test_integration(
    body: TestIntegrationRequest,
    claims: dict = Depends(current_user),
):
    """
    Test connectivity for a configured integration.
    For OAuth-only integrations, validates that all required fields are present.
    For API-key integrations, makes a live outbound call.
    Returns { success: bool, message: str }.
    """
    slug = body.integration
    creds = body.credentials

    def missing(*keys: str) -> Optional[str]:
        absent = [k for k in keys if not creds.get(k)]
        if absent:
            return f"Missing required fields: {', '.join(absent)}"
        return None

    # OAuth-only: just check all fields are present
    if slug in OAUTH_ONLY:
        err = missing(*list(creds.keys())) if not creds else None
        if not creds:
            return {"success": False, "message": "No credentials saved."}
        empty = [k for k, v in creds.items() if not v]
        if empty:
            return {"success": False, "message": f"Missing values for: {', '.join(empty)}"}
        return {"success": True, "message": "Fields complete. OAuth tokens require full authorization flow."}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            if slug == "twilio":
                err = missing("account_sid", "auth_token")
                if err:
                    return {"success": False, "message": err}
                r = await client.get(
                    f"https://api.twilio.com/2010-04-01/Accounts/{creds['account_sid']}.json",
                    auth=(creds["account_sid"], creds["auth_token"]),
                )
                if r.status_code == 200:
                    return {"success": True, "message": "Connected to Twilio successfully."}
                return {"success": False, "message": f"Twilio returned {r.status_code}: {r.text[:120]}"}

            elif slug == "sendgrid":
                err = missing("api_key")
                if err:
                    return {"success": False, "message": err}
                r = await client.get(
                    "https://api.sendgrid.com/v3/user/profile",
                    headers={"Authorization": f"Bearer {creds['api_key']}"},
                )
                if r.status_code == 200:
                    return {"success": True, "message": "Connected to SendGrid successfully."}
                return {"success": False, "message": f"SendGrid returned {r.status_code}."}

            elif slug == "calendly":
                err = missing("api_key")
                if err:
                    return {"success": False, "message": err}
                r = await client.get(
                    "https://api.calendly.com/users/me",
                    headers={"Authorization": f"Bearer {creds['api_key']}"},
                )
                if r.status_code == 200:
                    return {"success": True, "message": "Connected to Calendly successfully."}
                return {"success": False, "message": f"Calendly returned {r.status_code}."}

            elif slug == "dropbox_sign":
                err = missing("api_key")
                if err:
                    return {"success": False, "message": err}
                r = await client.get(
                    "https://api.hellosign.com/v3/account",
                    auth=(creds["api_key"], ""),
                )
                if r.status_code == 200:
                    return {"success": True, "message": "Connected to Dropbox Sign successfully."}
                return {"success": False, "message": f"Dropbox Sign returned {r.status_code}."}

            elif slug == "filevine":
                err = missing("personal_access_token", "api_base_url")
                if err:
                    return {"success": False, "message": err}
                base = creds["api_base_url"].rstrip("/")
                r = await client.get(
                    f"{base}/core/users/me",
                    headers={"Authorization": f"Bearer {creds['personal_access_token']}"},
                )
                if r.status_code == 200:
                    return {"success": True, "message": "Connected to Filevine successfully."}
                return {"success": False, "message": f"Filevine returned {r.status_code}."}

            elif slug == "lawpay":
                err = missing("secret_key")
                if err:
                    return {"success": False, "message": err}
                r = await client.get(
                    "https://api.affinipay.com/charges?limit=1",
                    headers={"Authorization": f"Bearer {creds['secret_key']}"},
                )
                if r.status_code in (200, 401):
                    ok = r.status_code == 200
                    return {"success": ok, "message": "Connected to LawPay successfully." if ok else "LawPay rejected the key — check secret_key."}
                return {"success": False, "message": f"LawPay returned {r.status_code}."}

            elif slug == "zapier":
                err = missing("webhook_url")
                if err:
                    return {"success": False, "message": err}
                url = creds["webhook_url"].strip()
                if url.startswith("https://hooks.zapier.com/") or url.startswith("http://"):
                    return {"success": True, "message": "Webhook URL format is valid."}
                return {"success": False, "message": "Invalid webhook URL — must start with https://hooks.zapier.com/"}

            else:
                return {"success": False, "message": f"Unknown integration: {slug}"}

        except httpx.TimeoutException:
            return {"success": False, "message": "Connection timed out."}
        except Exception as exc:
            return {"success": False, "message": f"Error: {str(exc)[:120]}"}
