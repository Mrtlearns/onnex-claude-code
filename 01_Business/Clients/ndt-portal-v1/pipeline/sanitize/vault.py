"""AES-256-GCM token vault for sanitized entity storage.

Tokens are deterministic (HMAC-SHA256 of entity type + plaintext value),
so the same entity always maps to the same token within a vault key.
This enables consistent masking across multiple documents in one intake session.

Token format: {TYPE}__{4 uppercase hex chars}
  COMPANY__A94F, DRAWING__K2D1, PERSON__3B7E, etc.

Security properties:
  - Plaintext never stored in DB — only AES-256-GCM ciphertext
  - Nonce (IV) is random per encryption — unique per vault entry
  - HMAC token derivation: deterministic but non-reversible without the key
  - Tag verification on decrypt prevents ciphertext tampering
"""
from __future__ import annotations

import hashlib
import hmac
import os
from base64 import b64encode, b64decode

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# ── Token generation ──────────────────────────────────────────────────────

_ENTITY_TYPE_ABBREV: dict[str, str] = {
    "DRAWING_NUMBER":   "DRAWING",
    "PART_NUMBER":      "PARTNUM",
    "CAGE_CODE":        "CAGE",
    "CONTRACT_NUMBER":  "CONTRACT",
    "CERT_ID":          "CERT",
    "PROJECT_CODE":     "PROJECT",
    "PERSON":           "PERSON",
    "EMAIL_ADDRESS":    "EMAIL",
    "PHONE_NUMBER":     "PHONE",
    "ORGANIZATION":     "COMPANY",
    "LOCATION":         "LOCATION",
    "URL":              "URL",
    "IP_ADDRESS":       "IP",
}


def entity_abbrev(entity_type: str) -> str:
    return _ENTITY_TYPE_ABBREV.get(entity_type, entity_type[:8].upper())


def derive_token(entity_type: str, plaintext: str, vault_key: bytes) -> str:
    """Derive a deterministic, non-reversible token from entity type + value.

    Uses HMAC-SHA256 to bind the token to the vault key — same plaintext
    always produces the same token under the same key, but the token
    reveals nothing about the plaintext without the key.

    Format: ABBREV__XXXX  (4 uppercase hex chars from HMAC digest)
    """
    abbrev = entity_abbrev(entity_type)
    digest = hmac.new(vault_key, f"{entity_type}:{plaintext}".encode(), hashlib.sha256).digest()
    suffix = digest[:2].hex().upper()
    return f"{abbrev}__{suffix}"


# ── Encryption / Decryption ───────────────────────────────────────────────

def encrypt(plaintext: str, vault_key: bytes) -> tuple[bytes, bytes]:
    """Encrypt plaintext with AES-256-GCM.

    Returns:
        (ciphertext_with_tag, nonce)  — both are raw bytes.
    """
    nonce = os.urandom(12)  # 96-bit GCM nonce
    aesgcm = AESGCM(vault_key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return ciphertext, nonce


def decrypt(ciphertext: bytes, nonce: bytes, vault_key: bytes) -> str:
    """Decrypt AES-256-GCM ciphertext.

    Raises cryptography.exceptions.InvalidTag if the ciphertext was tampered.
    """
    aesgcm = AESGCM(vault_key)
    plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext_bytes.decode("utf-8")


# ── Role-gated token classes ──────────────────────────────────────────────
# quote_engine may only see COMPANY (ORGANIZATION) and PART_NUMBER entities.
# audit role can see everything.
# analyst role can see everything except PERSON/EMAIL/PHONE.

ROLE_ALLOWED_TYPES: dict[str, set[str]] = {
    "quote_engine": {"ORGANIZATION", "PART_NUMBER", "DRAWING_NUMBER"},
    "analyst":      {"DRAWING_NUMBER", "PART_NUMBER", "CAGE_CODE", "CONTRACT_NUMBER",
                     "CERT_ID", "PROJECT_CODE", "ORGANIZATION", "LOCATION"},
    "audit":        None,  # None = all types allowed
}


def role_can_reveal(role: str, entity_type: str) -> bool:
    allowed = ROLE_ALLOWED_TYPES.get(role)
    if allowed is None:
        return True  # audit sees all
    return entity_type in allowed
