#!/usr/bin/env python3
"""
mem0_client.py — Core mem0 client factory for the Onnex Memory System.
All memory scripts import get_memory_client() and constants from here.

Stack:
  LLM:       OpenRouter (auto-detected via OPENROUTER_API_KEY env var)
  Embedder:  sentence-transformers/multi-qa-MiniLM-L6-cos-v1 (local CPU, 384-dim)
  Vectors:   ChromaDB embedded (no server, just a directory)
  History:   SQLite (mem0_history.db)
"""

import os
import warnings
warnings.filterwarnings('ignore')

from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

DATA_DIR = Path('/home/mrt/.onnex-memory')
CHROMA_DIR = DATA_DIR / 'chroma'
HISTORY_DB  = DATA_DIR / 'mem0_history.db'
ENV_FILE    = DATA_DIR / '.env'
INSTINCTS   = DATA_DIR / 'instincts.jsonl'
LOGS_DIR    = DATA_DIR / 'logs'
PENDING_DIR = DATA_DIR / 'pending_extraction'  # offline queue

# ---------------------------------------------------------------------------
# Load .env
# ---------------------------------------------------------------------------

def _load_env():
    if not ENV_FILE.exists():
        return
    with open(ENV_FILE, 'r', encoding='utf-8-sig') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

_load_env()

# ---------------------------------------------------------------------------
# User/Agent IDs
# ---------------------------------------------------------------------------

USER_ID  = os.getenv('MEMORY_USER_ID', 'mrtma')
AGENT_GLOBAL = 'global'

# ---------------------------------------------------------------------------
# mem0 config factory
# ---------------------------------------------------------------------------

def _make_config(agent_id: str) -> dict:
    return {
        'llm': {
            'provider': 'openai',
            'config': {
                'model': os.getenv('OPENROUTER_MODEL', 'openai/gpt-4o-mini'),
                'temperature': 0.1,
                'max_tokens': 1500,
            }
        },
        'embedder': {
            'provider': 'huggingface',
            'config': {
                'model': 'multi-qa-MiniLM-L6-cos-v1',
            }
        },
        'vector_store': {
            'provider': 'chroma',
            'config': {
                'collection_name': f'onnex_{agent_id}',
                'path': str(CHROMA_DIR),
            }
        },
        'history_db_path': str(HISTORY_DB),
    }

# ---------------------------------------------------------------------------
# Client cache (one per agent_id to avoid re-loading the embedding model)
# ---------------------------------------------------------------------------

_clients: dict = {}

def get_memory_client(agent_id: str = AGENT_GLOBAL):
    """Return a cached mem0 Memory instance for the given agent_id (project scope)."""
    if agent_id not in _clients:
        from mem0 import Memory
        _clients[agent_id] = Memory.from_config(config_dict=_make_config(agent_id))
    return _clients[agent_id]

# ---------------------------------------------------------------------------
# Secret scrubber — strip credentials before sending to any external API
# ---------------------------------------------------------------------------

import re as _re

_SECRET_PATTERNS = [
    (r'sk-[A-Za-z0-9_-]{20,}',                            '[REDACTED_SK_KEY]'),
    (r'sk-or-v1-[A-Za-z0-9_-]{20,}',                      '[REDACTED_OR_KEY]'),
    (r'pk_(?:live|test)_[A-Za-z0-9]{20,}',                '[REDACTED_PK_KEY]'),
    (r'xoxb-[A-Za-z0-9-]{20,}',                           '[REDACTED_SLACK]'),
    (r'ghp_[A-Za-z0-9]{20,}',                             '[REDACTED_GH_TOKEN]'),
    (r'Bearer\s+[A-Za-z0-9._-]{20,}',                     '[REDACTED_BEARER]'),
    (r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', '[REDACTED_JWT]'),
    (r'(?i)(?:api[_-]?key|secret|token|password)[\"\'\s:=]+[A-Za-z0-9+/=_-]{20,}', '[REDACTED_CRED]'),
    (r'(?:postgres|mysql|mongodb|redis)://[^\s]{15,}',    '[REDACTED_CONN]'),
    (r'Poll\d{4}',                                         '[REDACTED_PASS]'),
]

_compiled = [(_re.compile(p), r) for p, r in _SECRET_PATTERNS]

def sanitize(text: str) -> str:
    """Strip secrets from text before sending to any external API."""
    for pattern, replacement in _compiled:
        text = pattern.sub(replacement, text)
    return text

# ---------------------------------------------------------------------------
# Offline detection
# ---------------------------------------------------------------------------

def is_online(timeout: float = 2.0) -> bool:
    """Quick check if OpenRouter is reachable."""
    import socket
    try:
        socket.setdefaulttimeout(timeout)
        socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect(('openrouter.ai', 443))
        return True
    except Exception:
        return False
