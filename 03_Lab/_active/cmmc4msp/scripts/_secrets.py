"""
Centralised credential loader for deploy/admin scripts.

Order of precedence:
    1. Environment variable (preferred in CI + on shared shells)
    2. .env file at repo root (loaded if python-dotenv is installed)
    3. Interactive prompt via getpass (dev workstation only)

No secret is ever hardcoded in source. If a required value cannot be
resolved the script exits with a clear message.
"""
from __future__ import annotations

import getpass
import os
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _REPO_ROOT / ".env"


def _load_dotenv_once() -> None:
    """Populate os.environ from .env if possible (silent on failure)."""
    if getattr(_load_dotenv_once, "_done", False):
        return
    _load_dotenv_once._done = True  # type: ignore[attr-defined]

    if not _ENV_FILE.exists():
        return
    try:
        for raw in _ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            os.environ.setdefault(key, val)
    except Exception:
        pass


def require(name: str, *, prompt: str | None = None, secret: bool = True) -> str:
    """Return a credential or exit the script with a clear error.

    Args:
        name: environment variable name.
        prompt: human-readable prompt used if the value is missing and stdin
            is a tty. If None, fallback prompting is disabled.
        secret: if True, uses getpass (no echo); otherwise input().
    """
    _load_dotenv_once()

    val = os.environ.get(name)
    if val:
        return val

    if prompt and sys.stdin.isatty():
        val = getpass.getpass(prompt) if secret else input(prompt)
        if val:
            return val

    sys.stderr.write(
        f"[FATAL] Required credential '{name}' is not set.\n"
        f"        Set it in the environment or add it to {_ENV_FILE}.\n"
    )
    sys.exit(2)


def vm_ssh() -> tuple[str, str, str]:
    """Return (host, user, password) for the cmmc4msp VM."""
    host = os.environ.get("VM_SSH_HOST", "10.10.110.41")
    user = os.environ.get("VM_SSH_USER", "mrt")
    password = require("VM_SSH_PASSWORD", prompt=f"SSH password for {user}@{host}: ")
    return host, user, password


def hasura() -> tuple[str, str]:
    """Return (url, admin_secret) for Hasura."""
    url = os.environ.get("HASURA_URL", "https://gql.cmmc4msp.on-nex.us")
    secret = require("HASURA_ADMIN_SECRET", prompt="Hasura admin secret: ")
    return url, secret


def n8n_api() -> tuple[str, str]:
    """Return (url, api_key) for n8n."""
    url = os.environ.get("N8N_URL", "https://n8n.cmmc4msp.on-nex.us")
    key = require("N8N_API_KEY", prompt="n8n API key: ")
    return url, key
