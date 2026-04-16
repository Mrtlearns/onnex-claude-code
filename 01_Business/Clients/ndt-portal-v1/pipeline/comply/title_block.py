"""Engineering drawing title block extractor.

Extracts drawing number, CAGE code, and distribution statement
from PDF text using PyMuPDF. Falls back gracefully if text cannot
be extracted (scanned drawings need OCR upstream).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# ── Drawing number patterns ────────────────────────────────────────────────
# Covers common DoD and commercial format drawing numbers:
#   DWG-12345, 12345678, A-12345, XX-YYYYY-ZZ, P/N ########
_DRAWING_PATTERNS: list[re.Pattern] = [
    re.compile(r"\bDWG[\s\-#:]+([A-Z0-9][\w\-]{3,20})\b", re.IGNORECASE),
    re.compile(r"\bDRAWING[\s\-#:]+([A-Z0-9][\w\-]{3,20})\b", re.IGNORECASE),
    re.compile(r"\bD\.?W\.?G\.?\s*[#:]?\s*([A-Z0-9][\w\-]{3,20})\b", re.IGNORECASE),
    re.compile(r"\b([A-Z]{1,3}-\d{5,9}(?:-\d{1,4})?)\b"),          # XX-NNNNN or XX-NNNNN-NN
    re.compile(r"\b(\d{7,15})\b"),                                    # Long numeric DWG number
    re.compile(r"\bP/?N[\s:]+([A-Z0-9][\w\-]{3,20})\b", re.IGNORECASE),
]

# ── CAGE code pattern ──────────────────────────────────────────────────────
# CAGE codes are 5 alphanumeric characters, cannot start with I/O
_CAGE_PATTERN = re.compile(
    r"\b(?:CAGE|CAGE\s+CODE|COMPANY\s+ID)[\s:]+([A-HJ-NP-Z0-9]{5})\b",
    re.IGNORECASE,
)
_CAGE_BARE = re.compile(r"\b([A-HJ-NP-Z0-9]{5})\b")  # bare 5-char alphanumeric (lower confidence)

# ── Distribution statement patterns ───────────────────────────────────────
_DIST_PATTERN = re.compile(
    r"DISTRIBUTION\s+STATEMENT\s*:?\s*([A-Z](?:\s+[—\-–]?\s*[^\n]{0,120})?)",
    re.IGNORECASE,
)
_DIST_LETTER = re.compile(r"DISTRIBUTION\s+STATEMENT\s*([A-FX])\b", re.IGNORECASE)


@dataclass
class TitleBlockData:
    drawing_number: str | None      = None
    cage_codes:     list[str]       = field(default_factory=list)
    dist_statement: str | None      = None
    dist_letter:    str | None      = None  # A/B/C/D/E/F/X
    raw_text_len:   int             = 0


def extract_from_pdf(pdf_bytes: bytes) -> TitleBlockData:
    """Extract title block data from a PDF.

    Uses PyMuPDF to pull all text, then applies regex patterns.
    Returns best-confidence values found.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        return TitleBlockData()

    result = TitleBlockData()
    all_text_parts: list[str] = []

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for page in doc:
            all_text_parts.append(page.get_text())
        doc.close()
    except Exception:
        return result

    text = "\n".join(all_text_parts)
    result.raw_text_len = len(text)

    # ── Drawing number ─────────────────────────────────────────────────────
    for pat in _DRAWING_PATTERNS:
        m = pat.search(text)
        if m:
            result.drawing_number = m.group(1).strip()
            break

    # ── CAGE codes ─────────────────────────────────────────────────────────
    seen: set[str] = set()
    for m in _CAGE_PATTERN.finditer(text):
        code = m.group(1).upper()
        if code not in seen:
            seen.add(code)
            result.cage_codes.append(code)

    # ── Distribution statement ─────────────────────────────────────────────
    m = _DIST_PATTERN.search(text.upper())
    if m:
        result.dist_statement = m.group(0).strip()[:200]

    m2 = _DIST_LETTER.search(text.upper())
    if m2:
        result.dist_letter = m2.group(1).upper()

    return result


def extract_from_image_text(ocr_text: str) -> TitleBlockData:
    """Same extraction logic but from pre-extracted OCR text."""
    result = TitleBlockData()
    result.raw_text_len = len(ocr_text)

    for pat in _DRAWING_PATTERNS:
        m = pat.search(ocr_text)
        if m:
            result.drawing_number = m.group(1).strip()
            break

    seen: set[str] = set()
    for m in _CAGE_PATTERN.finditer(ocr_text):
        code = m.group(1).upper()
        if code not in seen:
            seen.add(code)
            result.cage_codes.append(code)

    m = _DIST_PATTERN.search(ocr_text.upper())
    if m:
        result.dist_statement = m.group(0).strip()[:200]

    m2 = _DIST_LETTER.search(ocr_text.upper())
    if m2:
        result.dist_letter = m2.group(1).upper()

    return result


# Distribution letter → rejection map
# D/E/F/X are restricted; C is limited; B is unlimited public release
DIST_ROUTING: dict[str, str] = {
    "A": "CLOUD_OK",    # Unlimited distribution
    "B": "CLOUD_OK",    # US Gov only (still cloud-safe for internal tools)
    "C": "LOCAL_ONLY",  # US Gov + specific contractors
    "D": "HOLD",        # DoD and contractors only — review required
    "E": "HOLD",        # DoD components only
    "F": "HOLD",        # Further distribution requires approval
    "X": "HOLD",        # Prohibited
}
