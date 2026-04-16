"""
mem_client.py — mem0 Memory client factory
Handles config, env loading, OpenRouter LLM, sentence-transformers embeddings, Chroma vector store.
All other memory scripts import get_memory_client() from here.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# ── Paths ───────────────────────────────────────────────────────────────────

# This script lives in .claude-global/skills/memory/scripts/
# WSL path: /mnt/d/Code/Claude/.claude-global/skills/memory/scripts/
SCRIPTS_DIR   = Path(__file__).resolve().parent
MEMORY_DIR    = Path.home() / ".onnex-memory"
CHROMA_PATH   = MEMORY_DIR / "chroma"
FTS_DB_PATH   = MEMORY_DIR / "fts" / "memory_fts.db"
LOGS_DIR      = MEMORY_DIR / "logs"
PENDING_DIR   = MEMORY_DIR / "pending"
MARKERS_DIR   = MEMORY_DIR / "data" / "capture_markers"

# Global MEMORY.md — written back to the Windows workspace so Claude Code reads it
GLOBAL_MEMORY_MD = Path("/mnt/d/Code/Claude/.claude-global/memory/MEMORY.md")
INSTINCTS_FILE   = Path("/mnt/d/Code/Claude/.claude-global/memory/instincts.jsonl")

# ── Env ─────────────────────────────────────────────────────────────────────

load_dotenv(MEMORY_DIR / ".env", encoding="utf-8")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL   = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
MEMORY_USER_ID     = os.getenv("MEMORY_USER_ID", "mrtma")

# ── Secrets scrubber ─────────────────────────────────────────────────────────

import re as _re

_SECRET_PATTERNS = [
    (r"sk-[A-Za-z0-9_-]{20,}",                           "[REDACTED_SK_KEY]"),
    (r"sk-or-v1-[A-Za-z0-9_-]{20,}",                     "[REDACTED_OR_KEY]"),
    (r"pk_(?:live|test)_[A-Za-z0-9]{20,}",               "[REDACTED_PK_KEY]"),
    (r"xoxb-[A-Za-z0-9-]{20,}",                          "[REDACTED_SLACK_TOKEN]"),
    (r"ghp_[A-Za-z0-9]{20,}",                            "[REDACTED_GITHUB_TOKEN]"),
    (r"pcsk_[A-Za-z0-9_-]{20,}",                         "[REDACTED_PINECONE_KEY]"),
    (r"AIzaSy[A-Za-z0-9_-]{20,}",                        "[REDACTED_GOOGLE_KEY]"),
    (r"Bearer\s+[A-Za-z0-9._-]{20,}",                    "[REDACTED_BEARER]"),
    (r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}", "[REDACTED_JWT]"),
    (r"(?i)(?:api[_-]?key|secret|token|password|credential)[\"\'\s:=]+[A-Za-z0-9+/=_-]{20,}", "[REDACTED_CREDENTIAL]"),
    (r"(?:postgres|mysql|mongodb|redis)://[^\s]{15,}", "[REDACTED_CONN_STRING]"),
]
_compiled = [(_re.compile(p), r) for p, r in _SECRET_PATTERNS]

def sanitize_text(text: str) -> str:
    """Strip secrets before sending to any external API."""
    for pattern, replacement in _compiled:
        text = pattern.sub(replacement, text)
    return text

# ── Online detection ─────────────────────────────────────────────────────────

def is_online() -> bool:
    """Quick check if OpenRouter is reachable."""
    import urllib.request
    try:
        urllib.request.urlopen("https://openrouter.ai", timeout=3)
        return True
    except Exception:
        return False

# ── mem0 client factory ──────────────────────────────────────────────────────

_client_cache: dict = {}

def get_memory_client(agent_id: str = "global"):
    """
    Return a cached mem0 Memory instance scoped to agent_id.
    Uses Chroma (local) + sentence-transformers (CPU, offline-safe).
    LLM: OpenRouter gpt-4o-mini (online) — used only for extraction, not search.
    """
    if agent_id in _client_cache:
        return _client_cache[agent_id]

    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not set in ~/.onnex-memory/.env")

    CHROMA_PATH.mkdir(parents=True, exist_ok=True)

    from mem0 import Memory

    config = {
        "llm": {
            "provider": "openai",
            "config": {
                "model": OPENROUTER_MODEL,
                "openai_api_base": "https://openrouter.ai/api/v1",
                "api_key": OPENROUTER_API_KEY,
                "temperature": 0.1,
                "max_tokens": 1500,
            },
        },
        "embedder": {
            "provider": "huggingface",
            "config": {
                "model": "sentence-transformers/all-MiniLM-L6-v2",
                "embedding_dims": 384,
            },
        },
        "vector_store": {
            "provider": "chroma",
            "config": {
                "collection_name": f"onnex_{agent_id}",
                "path": str(CHROMA_PATH),
            },
        },
        "history_db_path": str(MEMORY_DIR / f"history_{agent_id}.db"),
    }

    client = Memory.from_config(config_dict=config)
    _client_cache[agent_id] = client
    return client
