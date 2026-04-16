#!/usr/bin/env python3
# v2.0 — NDT Portal ASME PDF-to-Markdown batch converter
#
# v2.0 changes from v1.0:
#   - Replaced custom column-blind text extraction with pymupdf4llm, which
#     uses layout-aware extraction (textracer / ML-based column detection).
#     Fixes multi-column text interleaving that garbled ASME two-column PDFs.
#   - Added noise-table filter: suppresses single-column copyright/license blocks
#     that pdfplumber and PyMuPDF incorrectly detect as data tables.
#   - Improved ASME heading post-processing: scans pymupdf4llm output line-by-line
#     and promotes undetected clause patterns (UW-11, T-233.2, etc.) to headings.
#   - Fixed edition/year extraction bug: re.findall with capturing group returned
#     only the group prefix ("20"), not the full year ("2015").
#   - Dropped pdfplumber dependency (pymupdf4llm handles tables natively).
#
# Converts a directory of technical PDFs into:
#   _human_md/    High-fidelity column-aware markdown for human reading/review
#   _llm_md/      Clause-chunked, normative-tagged markdown for LLM prompt injection
#   _qa_reports/  Per-file JSON reports + batch CSV/JSON summary

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import re
import shutil
import sys
import traceback
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import fitz            # PyMuPDF — still used for metadata, OCR fallback
    import pymupdf4llm     # column-aware PDF → markdown
    import pytesseract
    from PIL import Image
except ImportError as exc:
    missing = str(exc).split()[-1].strip("'")
    raise SystemExit(
        f"Missing dependency: {missing}. Run: pip install -r requirements.txt\n"
        "Also ensure the 'tesseract' binary is installed if OCR is enabled."
    ) from exc


# ─────────────────────────────────────────────────────────────────────────────
# ASME clause patterns — ordered most to least specific
# ─────────────────────────────────────────────────────────────────────────────

ASME_CLAUSE_RE = [
    re.compile(r"^((?:MANDATORY|NONMANDATORY)\s+APPENDIX\s+\w+)\s*(.*)", re.IGNORECASE),
    re.compile(r"^([A-Z]{1,4}-\d+(?:\([a-zA-Z0-9]\))+)\s+(.+)"),   # UW-11(a)(1)
    re.compile(r"^([A-Z]{1,4}-\d+(?:\.\d+)*)\s+(.+)"),              # UW-11, T-271.1
    re.compile(r"^(TABLE\s+[A-Z]+-\d+(?:\.\d+)*[A-Z]?)\s*(.*)", re.IGNORECASE),
    re.compile(r"^(FIGURE\s+[A-Z]+-\d+(?:\.\d+)*[A-Z]?)\s*(.*)", re.IGNORECASE),
    re.compile(r"^(\d{3}(?:\.\d+){1,3})\s+(.+)"),                    # 341.3.2
    re.compile(r"^(\d+(?:\.\d+)+)\s+(.+)"),                          # 1.2.3 fallback
]

NORMATIVE_RE = re.compile(
    r"\b(shall\s+not|must\s+not|shall|must|is\s+required|should|may\s+not|may|"
    r"not\s+permitted|prohibited|is\s+prohibited)\b",
    re.IGNORECASE,
)

CRITICAL_CLAUSES = {
    "UW-11", "UW-51", "UW-52", "UCS-56", "UG-20", "UG-84", "T-233", "T-234",
    "T-271", "T-285", "341.4", "341.3.2", "304.1",
}

CRITICAL_TABLE_RE = re.compile(
    r"\b(TABLE\s+(?:UW-12|UCS-66|UHT-56|UG-84|UCS-56|341\.1|341\.3\.2|T-22[0-9]))\b",
    re.IGNORECASE,
)

CROSS_REF_RE = re.compile(r"\b([A-Z]{1,4}-\d+(?:\([a-zA-Z0-9]\))*(?:\.\d+)*)\b")
PAGE_MARKER_RE = re.compile(r"^<!--\s*page:(\d+)\s*-->$")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$")
MULTISPACE_RE = re.compile(r"[ \t]{2,}")
BLANKS_RE = re.compile(r"\n{3,}")

# Noise table detection: single/dual column tables containing copyright/license text
NOISE_TABLE_KEYWORDS = {"copyright", "license", "resale", "licensee", "provided by ihs",
                        "reproduction", "networking permitted", "not for resale"}


# ─────────────────────────────────────────────────────────────────────────────
# Data classes
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Config:
    source_dir: Path
    workers: int = 4
    enable_ocr: bool = True
    min_text_chars_per_page: int = 80
    ocr_lang: str = "eng"
    render_dpi: int = 220
    max_heading_length: int = 200
    force: bool = False
    verbose: bool = False


@dataclass
class FileSummary:
    source_pdf: str
    status: str
    classification: str
    page_count: int
    native_text_pages: int
    ocr_pages: int
    headings_detected: int
    tables_extracted: int
    critical_tables: list = field(default_factory=list)
    rules_extracted: int = 0
    rules_by_keyword: dict = field(default_factory=dict)
    warnings: int = 0
    elapsed_seconds: float = 0.0
    human_md: str = ""
    llm_md: str = ""
    report_json: str = ""
    error: str = ""
    skipped: bool = False


# ─────────────────────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────────────────────

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def safe_slug(name: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-._")
    return slug or "document"


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def normalize_text(value: str) -> str:
    value = value.replace("\x00", " ").replace("\u00a0", " ").replace("\r", "\n")
    value = MULTISPACE_RE.sub(" ", value)
    value = re.sub(r"\n[ \t]+", "\n", value)
    value = BLANKS_RE.sub("\n\n", value)
    return value.strip()


def markdown_escape_cell(text: str) -> str:
    return text.replace("|", r"\|").replace("\n", " ")


def is_bold(font_name: str) -> bool:
    lo = (font_name or "").lower()
    return any(t in lo for t in ("bold", "black", "heavy", "demi"))


# ─────────────────────────────────────────────────────────────────────────────
# PDF metadata helpers (still use fitz directly)
# ─────────────────────────────────────────────────────────────────────────────

def weighted_body_font_size(doc: fitz.Document) -> float:
    weights: Counter[float] = Counter()
    for page in doc:
        for block in page.get_text("dict").get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = str(span.get("text", "")).strip()
                    if not text:
                        continue
                    size = round(float(span.get("size", 0.0)) * 2) / 2
                    weights[size] += max(1, len(text))
    return float(max(weights.items(), key=lambda kv: kv[1])[0]) if weights else 11.0


def detect_title(doc: fitz.Document, body_size: float) -> str:
    if not doc:
        return "Untitled Document"
    candidates: list[tuple[float, str]] = []
    for block in doc[0].get_text("dict").get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            text = normalize_text("".join(str(s.get("text", "")) for s in spans))
            if len(text) < 5 or re.fullmatch(r"[\d\s]+", text):
                continue
            if text.lower().startswith(("page ", "revision", "issued", "approved", "date")):
                continue
            max_size = max((float(s.get("size", 0)) for s in spans), default=0.0)
            bold = any(is_bold(str(s.get("font", ""))) for s in spans)
            score = max_size + (0.5 if bold else 0)
            if score >= body_size * 1.15:
                candidates.append((score, text[:200]))
    if candidates:
        return max(candidates, key=lambda x: x[0])[1]
    meta_title = (doc.metadata or {}).get("title", "").strip()
    return meta_title[:200] if meta_title else "Untitled Document"


def detect_code_metadata(doc: fitz.Document) -> dict[str, str]:
    """Extract code designation and edition year from first 3 pages."""
    # Fixed: use non-capturing group so findall returns full year not prefix
    year_re = re.compile(r"\b(?:19|20)\d{2}\b")
    code_re = re.compile(
        r"\b(BPVC[\s-]*(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)"
        r"(?:[\s-]*(?:D(?:iv(?:ision)?)?[\s.-]*[12])?)?|"
        r"B31\.\d+|B16\.\d+|ASME\s+Y14\.\d+)\b",
        re.IGNORECASE,
    )
    code = ""
    edition = ""
    for page_idx in range(min(3, len(doc))):
        text = doc[page_idx].get_text("text")
        if not code:
            m = code_re.search(text)
            if m:
                code = m.group(0).strip()
        if not edition:
            years = year_re.findall(text)  # now returns full 4-digit years
            if years:
                edition = max(years)       # e.g. "2015", not "20"
        if code and edition:
            break
    return {"code": code, "edition": edition}


def classify_document(doc: fitz.Document, min_chars: int) -> dict[str, Any]:
    native = sum(
        1 for page in doc
        if len(normalize_text(page.get_text("text"))) >= min_chars
    )
    page_count = len(doc)
    ratio = native / page_count if page_count else 0.0
    classification = (
        "born_digital" if ratio >= 0.85 else
        "scanned"      if ratio <= 0.15 else
        "mixed"
    )
    return {
        "classification": classification,
        "page_count": page_count,
        "native_text_pages": native,
    }


def ocr_page_text(page: fitz.Page, dpi: int, lang: str) -> str:
    if shutil.which("tesseract") is None:
        raise RuntimeError("tesseract not found — install Tesseract OCR or use --skip-ocr")
    scale = dpi / 72.0
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples).convert("L")
    return normalize_text(pytesseract.image_to_string(image, lang=lang, config="--psm 3"))


# ─────────────────────────────────────────────────────────────────────────────
# ASME heading detection & post-processing
# ─────────────────────────────────────────────────────────────────────────────

def match_asme_clause(text: str) -> tuple[str, str] | None:
    for pat in ASME_CLAUSE_RE:
        m = pat.match(text.strip())
        if m:
            clause_id = m.group(1).strip()
            rest = m.group(2).strip() if len(m.groups()) >= 2 else ""
            return (clause_id, rest)
    return None


def heading_level_from_clause(clause_id: str) -> int:
    ci = clause_id.upper()
    if re.match(r"(?:MANDATORY|NONMANDATORY)", ci):
        return 2
    if re.match(r"(?:TABLE|FIGURE)\s+", ci):
        return 4
    paren_depth = ci.count("(")
    dot_depth = len(re.findall(r"\.", ci))
    return min(6, 2 + paren_depth + dot_depth)


def improve_asme_headings(page_md: str) -> tuple[str, int]:
    """
    Post-process pymupdf4llm output to improve ASME clause heading levels.

    pymupdf4llm detects headings via font-size heuristics, but ASME clause
    patterns (UW-11, T-233.2 etc.) sometimes appear at body font size or are
    detected at the wrong level.  This pass normalises them.

    Returns (improved_markdown, headings_count).
    """
    out: list[str] = []
    count = 0

    for line in page_md.splitlines():
        stripped = line.strip()

        # Already a heading — reclassify level if it matches an ASME pattern
        if line.startswith("#"):
            heading_text = re.sub(r"^#+\s*", "", line).strip()
            clause = match_asme_clause(heading_text)
            if clause:
                cid, rest = clause
                level = heading_level_from_clause(cid)
                display = f"{cid} {rest}".strip() if rest else cid
                out.append(f"{'#' * level} {display}")
            else:
                out.append(line)
            count += 1
            continue

        # Body line — promote to heading if it matches ASME clause pattern
        if stripped and not stripped.startswith(("|", "-", "*", ">", "!", "<!--", "_")):
            clause = match_asme_clause(stripped)
            if clause:
                cid, rest = clause
                full_display = f"{cid} {rest}".strip() if rest else cid
                # Only promote if the rest part is short (a real heading, not body text)
                if rest and len(rest.split()) <= 20:
                    level = heading_level_from_clause(cid)
                    out.append(f"{'#' * level} {full_display}")
                    count += 1
                    continue

        out.append(line)

    return "\n".join(out), count


# ─────────────────────────────────────────────────────────────────────────────
# Noise table filter
# ─────────────────────────────────────────────────────────────────────────────

def _is_noise_table(table_block: list[str]) -> bool:
    """Return True if this GFM table block is a copyright/license noise block."""
    content = " ".join(table_block).lower()
    # Multi-column tables with data are never noise
    col_count = max(
        (len([c for c in row.split("|") if c.strip()]) for row in table_block if "|" in row),
        default=0,
    )
    if col_count > 2:
        return False
    hits = sum(1 for kw in NOISE_TABLE_KEYWORDS if kw in content)
    return hits >= 2


def filter_noise_tables(md_text: str) -> tuple[str, int, int]:
    """
    Remove single-column copyright/license tables from pymupdf4llm output.
    Returns (filtered_text, tables_kept, tables_removed).
    """
    lines = md_text.splitlines()
    out: list[str] = []
    i = 0
    kept = 0
    removed = 0

    while i < len(lines):
        line = lines[i]
        # Detect table start
        if line.strip().startswith("|"):
            table_block: list[str] = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_block.append(lines[i])
                i += 1
            if _is_noise_table(table_block):
                removed += 1
            else:
                out.extend(table_block)
                kept += 1
            continue
        out.append(line)
        i += 1

    return "\n".join(out), kept, removed


def count_critical_tables(md_text: str) -> list[str]:
    return list(dict.fromkeys(CRITICAL_TABLE_RE.findall(md_text)))


# ─────────────────────────────────────────────────────────────────────────────
# Human markdown builder — uses pymupdf4llm
# ─────────────────────────────────────────────────────────────────────────────

def build_human_markdown(
    pdf_path: Path,
    cfg: Config,
    doc: fitz.Document,
    classification: dict[str, Any],
    code_meta: dict[str, str],
) -> tuple[str, dict[str, Any]]:

    body_size    = weighted_body_font_size(doc)
    title        = detect_title(doc, body_size)
    page_count   = classification["page_count"]
    meta         = doc.metadata or {}
    code_str     = code_meta.get("code", "") or meta.get("title", "") or pdf_path.stem
    edition_str  = code_meta.get("edition", "")

    warnings:        list[str] = []
    ocr_pages:       list[int] = []
    headings_total   = 0
    tables_kept      = 0

    # ── 1. pymupdf4llm extraction ─────────────────────────────────────────────
    try:
        chunks = pymupdf4llm.to_markdown(
            str(pdf_path),
            page_chunks=True,
            show_progress=False,
            write_images=False,
        )
    except Exception as exc:
        warnings.append(f"pymupdf4llm failed: {exc}")
        chunks = []

    # ── 2. Build output ───────────────────────────────────────────────────────
    lines: list[str] = [
        "---",
        f'title: "{title.replace(chr(34), chr(39))}"',
        f'source: "{pdf_path.name.replace(chr(34), chr(39))}"',
        f'code: "{code_str}"',
        f'edition: "{edition_str}"',
        f'converted: "{utc_now_iso()}"',
        f'pages: {page_count}',
        f'method: "{classification["classification"]}"',
        'converter: "ndt-portal/tools/pdf_to_markdown v2.0"',
        "---",
        "",
        f"# {title}",
        "",
        "## Document Metadata",
        f"- File: `{pdf_path.name}`",
        f"- Code: {code_str or 'n/a'}",
        f"- Edition: {edition_str or 'unknown'}",
        f"- Pages: {page_count}",
        f"- PDF Author: {meta.get('author') or 'n/a'}",
        f"- Conversion method: {classification['classification']}",
        "",
    ]

    # Map chunk index → page number (0-based from pymupdf4llm)
    chunk_map: dict[int, str] = {
        chunk["metadata"]["page"]: chunk["text"]
        for chunk in chunks
        if "metadata" in chunk and "page" in chunk["metadata"]
    }

    for pnum in range(1, page_count + 1):
        lines.append(f"<!-- page:{pnum} -->")
        lines.append("")

        page_text = chunk_map.get(pnum - 1, "").strip()

        if page_text:
            # Filter copyright/license noise tables
            filtered, kept, removed = filter_noise_tables(page_text)
            tables_kept += kept
            if removed:
                logging.debug("Page %d: removed %d noise table(s)", pnum, removed)

            # Improve ASME heading levels
            improved, page_headings = improve_asme_headings(filtered)
            headings_total += page_headings
            lines.append(improved)

        else:
            # No text extracted — try OCR on low-text pages
            if cfg.enable_ocr:
                try:
                    ocr_text = ocr_page_text(doc[pnum - 1], cfg.render_dpi, cfg.ocr_lang)
                    if ocr_text:
                        ocr_pages.append(pnum)
                        lines.append("_[OCR extracted text]_")
                        lines.append("")
                        lines.append(ocr_text)
                    else:
                        warnings.append(f"Page {pnum}: OCR returned no text")
                except Exception as exc:
                    warnings.append(f"Page {pnum}: OCR failed: {exc}")
            else:
                warnings.append(f"Page {pnum}: no text extracted")

        lines.append("")

    human_md = normalize_text("\n".join(lines)) + "\n"

    # Count critical tables in the full output
    critical_tables = count_critical_tables(human_md)

    report = {
        "source_file":      str(pdf_path),
        "title":            title,
        "code_meta":        code_meta,
        "classification":   classification,
        "ocr_pages":        ocr_pages,
        "headings_detected": headings_total,
        "tables_extracted": tables_kept,
        "critical_tables":  critical_tables,
        "warnings":         warnings,
        "body_font_size":   body_size,
    }
    return human_md, report


# ─────────────────────────────────────────────────────────────────────────────
# LLM markdown builder — clause-chunked normative extraction
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ClauseBlock:
    clause_id:    str
    heading_text: str
    level:        int
    page:         int = 0
    rules:        list = field(default_factory=list)
    table_mds:    list = field(default_factory=list)
    cross_refs:   set  = field(default_factory=set)


def infer_requirement_type(text: str) -> str:
    lo = text.lower()
    if "shall not" in lo or "must not" in lo or "is prohibited" in lo or "not permitted" in lo:
        return "PROHIBITION"
    if "shall" in lo or "must" in lo or "is required" in lo:
        return "SHALL"
    if "should" in lo:
        return "SHOULD"
    if "may not" in lo:
        return "MAY_NOT"
    if "may" in lo:
        return "MAY"
    return "UNCLASSIFIED"


def infer_severity(text: str, clause_id: str) -> str:
    lo = text.lower()
    base = re.match(r"([A-Z]+-\d+|\d{3}\.\d+)", clause_id.upper())
    if base and base.group(0) in CRITICAL_CLAUSES:
        return "CRITICAL"
    if any(kw in lo for kw in ("lethal", "repair weld", "full radiograph", "100%", "all butt")):
        return "CRITICAL"
    req = infer_requirement_type(text)
    if req == "PROHIBITION":  return "CRITICAL"
    if req == "SHALL":        return "HIGH"
    if req == "SHOULD":       return "MEDIUM"
    if req in ("MAY", "MAY_NOT"): return "LOW"
    return "INFO"


def extract_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.;])\s+(?=[A-Z(])", text)
    return [p.strip() for p in parts if p.strip()]


def extract_cross_refs(text: str) -> list[str]:
    refs = CROSS_REF_RE.findall(text)
    return sorted(set(r for r in refs if len(r) > 3 and not re.fullmatch(r"\d+", r)))


def _infer_part_name(clause_id: str) -> str:
    PREFIX_MAP = {
        "UG":  "General Requirements",
        "UW":  "Requirements for Pressure Vessels Fabricated by Welding",
        "UF":  "Requirements for Pressure Vessels Fabricated by Forging",
        "UCS": "Requirements for Carbon and Low Alloy Steel Pressure Vessels",
        "UNF": "Requirements for Nonferrous Material Pressure Vessels",
        "UHA": "Requirements for High Alloy Steel Pressure Vessels",
        "UHT": "Requirements for Ferritic Steels with Enhanced Tensile Properties",
        "T":   "ASME V Test Methods",
    }
    m = re.match(r"^([A-Z]{1,4})-", clause_id.upper())
    return PREFIX_MAP.get(m.group(1), "") if m else ""


def _infer_scope_hint(clause_id: str) -> str:
    SCOPE_MAP = {
        "UW-11":    "Determines extent of radiographic examination required",
        "UW-51":    "Acceptance criteria for radiographically examined welds",
        "UW-52":    "Spot radiography acceptance criteria",
        "UCS-56":   "PWHT requirements based on P-Number and material thickness",
        "UCS-66":   "MDMT and impact test requirements",
        "UG-20":    "Lethal service designation",
        "T-233":    "IQI (penetrameter) requirements — source-side placement",
        "T-271":    "Film type and exposure technique",
        "341.3.2":  "Acceptance criteria for welds in B31.3 piping",
        "304.1":    "Pressure design of piping components",
    }
    base = re.match(r"([A-Z]+-\d+|\d{3}\.\d+)", clause_id.upper())
    return SCOPE_MAP.get(base.group(0), "") if base else ""


def build_llm_markdown(
    human_markdown: str,
    source_pdf_name: str,
    code_meta: dict[str, str],
) -> tuple[str, dict[str, Any]]:

    code_str = code_meta.get("code", "") or source_pdf_name
    edition  = code_meta.get("edition", "")

    blocks: list[ClauseBlock] = []
    current: ClauseBlock | None = None
    current_page = 1
    in_yaml = False
    in_table = False
    table_lines: list[str] = []

    for raw in human_markdown.splitlines():
        line = raw.rstrip()

        if line.strip() == "---":
            in_yaml = not in_yaml
            continue
        if in_yaml:
            continue

        pm = PAGE_MARKER_RE.match(line)
        if pm:
            current_page = int(pm.group(1))
            continue

        # Table accumulation
        if line.startswith("|") or (in_table and line.startswith("|")):
            in_table = True
            table_lines.append(line)
            continue
        if in_table:
            in_table = False
            if current and table_lines:
                current.table_mds.append("\n".join(table_lines))
            table_lines = []

        # Headings
        hm = HEADING_RE.match(line)
        if hm:
            level = len(hm.group(1))
            heading_text = hm.group(2).strip()
            clause = match_asme_clause(heading_text)
            cid  = clause[0] if clause else ""
            rest = clause[1] if clause and clause[1] else heading_text

            if level <= 3 and (cid or level == 2):
                if current:
                    blocks.append(current)
                current = ClauseBlock(
                    clause_id=cid or heading_text,
                    heading_text=rest,
                    level=level,
                    page=current_page,
                )
            elif current:
                current.cross_refs.update(extract_cross_refs(heading_text))
            continue

        stripped = line.strip()
        if not stripped or stripped.startswith(("<!--", "_[")):
            continue

        if current:
            for ref in extract_cross_refs(stripped):
                if ref != current.clause_id:
                    current.cross_refs.add(ref)
            for sent in extract_sentences(stripped):
                if NORMATIVE_RE.search(sent):
                    current.rules.append({
                        "clause_id": current.clause_id,
                        "text":      sent,
                        "type":      infer_requirement_type(sent),
                        "severity":  infer_severity(sent, current.clause_id),
                    })

    if current:
        blocks.append(current)
    if in_table and table_lines and blocks:
        blocks[-1].table_mds.append("\n".join(table_lines))

    total_rules = sum(len(b.rules) for b in blocks)
    keyword_counts: Counter[str] = Counter(r["type"] for b in blocks for r in b.rules)

    llm_lines: list[str] = [
        "---",
        f'source: "{source_pdf_name.replace(chr(34), chr(39))}"',
        f'code: "{code_str}"',
        f'edition: "{edition}"',
        'type: "llm_rules"',
        f'converted: "{utc_now_iso()}"',
        f'total_rules: {total_rules}',
        f'total_clauses: {len(blocks)}',
        "---",
        "",
        f"# LLM Rules: {source_pdf_name}",
        "",
        "## Usage Guidance",
        "- Each `##` section is a self-contained clause — select by heading prefix.",
        "- Severity: CRITICAL > HIGH > MEDIUM > LOW > INFO",
        "- Always verify CRITICAL/HIGH rules against the original PDF.",
        f"- Code: {code_str or 'n/a'}  Edition: {edition or 'unknown'}",
        "",
    ]

    for block in blocks:
        if not block.rules and not block.table_mds:
            continue

        part   = _infer_part_name(block.clause_id)
        scope  = _infer_scope_hint(block.clause_id)

        llm_lines.append(f"## {block.clause_id} {block.heading_text}".rstrip())
        llm_lines.append("")
        llm_lines.append("### Context")
        llm_lines.append(f"- Code: {code_str or 'n/a'}")
        if part:  llm_lines.append(f"- Part: {part}")
        if scope: llm_lines.append(f"- Scope: {scope}")
        if block.page: llm_lines.append(f"- Source page: {block.page}")
        llm_lines.append("")

        if block.rules:
            llm_lines.append("### Rules")
            llm_lines.append("")
            for rule in block.rules:
                cid_tag = f"[{rule['clause_id']}] " if rule["clause_id"] != block.clause_id else ""
                llm_lines.append(
                    f"- **{cid_tag}[{rule['type']}]** {rule['text']} [Severity: {rule['severity']}]"
                )
            llm_lines.append("")

        if block.table_mds:
            llm_lines.append("### Tables")
            llm_lines.append("")
            for tmd in block.table_mds:
                llm_lines.append(tmd)
                llm_lines.append("")

        refs = sorted(block.cross_refs - {block.clause_id})[:20]
        if refs:
            llm_lines.append("### Cross-References")
            for ref in refs:
                llm_lines.append(f"- {ref}")
            llm_lines.append("")

    llm_md = "\n".join(llm_lines).rstrip() + "\n"
    return llm_md, {
        "rules_extracted":    total_rules,
        "rules_by_keyword":   dict(keyword_counts),
        "clauses_with_rules": len([b for b in blocks if b.rules]),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Idempotency
# ─────────────────────────────────────────────────────────────────────────────

def should_skip(pdf_path: Path, human_path: Path, llm_path: Path) -> bool:
    try:
        src_mtime = pdf_path.stat().st_mtime
        return (
            human_path.exists() and llm_path.exists()
            and human_path.stat().st_mtime >= src_mtime
            and llm_path.stat().st_mtime >= src_mtime
        )
    except OSError:
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Per-file processor
# ─────────────────────────────────────────────────────────────────────────────

def process_pdf(pdf_path: Path, cfg: Config) -> FileSummary:
    started   = datetime.now(timezone.utc)
    slug      = safe_slug(pdf_path.stem)
    human_dir = cfg.source_dir / "_human_md"
    llm_dir   = cfg.source_dir / "_llm_md"
    qa_dir    = cfg.source_dir / "_qa_reports"
    ensure_dir(human_dir); ensure_dir(llm_dir); ensure_dir(qa_dir)

    human_path  = human_dir  / f"{slug}.md"
    llm_path    = llm_dir    / f"{slug}.md"
    report_path = qa_dir     / f"{slug}_report.json"

    if not cfg.force and should_skip(pdf_path, human_path, llm_path):
        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        return FileSummary(
            source_pdf=str(pdf_path), status="ok", classification="skipped",
            page_count=0, native_text_pages=0, ocr_pages=0,
            headings_detected=0, tables_extracted=0,
            elapsed_seconds=round(elapsed, 2),
            human_md=str(human_path), llm_md=str(llm_path),
            report_json=str(report_path), skipped=True,
        )

    try:
        doc = fitz.open(str(pdf_path))
        if doc.needs_pass:
            raise RuntimeError("Encrypted PDF — cannot convert")

        code_meta      = detect_code_metadata(doc)
        classification = classify_document(doc, cfg.min_text_chars_per_page)
        human_md, h_report = build_human_markdown(pdf_path, cfg, doc, classification, code_meta)
        llm_md, llm_report = build_llm_markdown(human_md, pdf_path.name, code_meta)
        doc.close()

        human_path.write_text(human_md, encoding="utf-8")
        llm_path.write_text(llm_md, encoding="utf-8")

        full_report = {
            "source_pdf":        str(pdf_path),
            "generated_utc":     utc_now_iso(),
            "code_meta":         code_meta,
            "classification":    classification,
            "headings_detected": h_report["headings_detected"],
            "tables_extracted":  h_report["tables_extracted"],
            "critical_tables":   h_report["critical_tables"],
            "ocr_pages":         h_report["ocr_pages"],
            "rules_extracted":   llm_report["rules_extracted"],
            "rules_by_keyword":  llm_report["rules_by_keyword"],
            "clauses_with_rules":llm_report["clauses_with_rules"],
            "warnings":          h_report["warnings"],
        }
        report_path.write_text(json.dumps(full_report, indent=2, ensure_ascii=False), encoding="utf-8")

        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        return FileSummary(
            source_pdf=str(pdf_path), status="ok",
            classification=classification["classification"],
            page_count=classification["page_count"],
            native_text_pages=classification["native_text_pages"],
            ocr_pages=len(h_report["ocr_pages"]),
            headings_detected=h_report["headings_detected"],
            tables_extracted=h_report["tables_extracted"],
            critical_tables=h_report["critical_tables"],
            rules_extracted=llm_report["rules_extracted"],
            rules_by_keyword=llm_report["rules_by_keyword"],
            warnings=len(h_report["warnings"]),
            elapsed_seconds=round(elapsed, 2),
            human_md=str(human_path), llm_md=str(llm_path),
            report_json=str(report_path),
        )

    except Exception as exc:
        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        report_path.write_text(
            json.dumps({
                "source_pdf": str(pdf_path), "generated_utc": utc_now_iso(),
                "status": "error", "error": str(exc),
                "traceback": traceback.format_exc(),
            }, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return FileSummary(
            source_pdf=str(pdf_path), status="error", classification="unknown",
            page_count=0, native_text_pages=0, ocr_pages=0,
            headings_detected=0, tables_extracted=0,
            elapsed_seconds=round(elapsed, 2),
            report_json=str(report_path), error=str(exc),
        )


# ─────────────────────────────────────────────────────────────────────────────
# Batch summary
# ─────────────────────────────────────────────────────────────────────────────

def write_batch_summary(qa_dir: Path, summaries: list[FileSummary]) -> tuple[Path, Path]:
    ensure_dir(qa_dir)
    csv_path  = qa_dir / "batch_summary.csv"
    json_path = qa_dir / "batch_summary.json"

    fieldnames = [
        "source_pdf", "status", "skipped", "classification", "page_count",
        "native_text_pages", "ocr_pages", "headings_detected", "tables_extracted",
        "rules_extracted", "warnings", "elapsed_seconds", "error",
    ]
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for s in summaries:
            d = asdict(s)
            d["critical_tables"]  = "; ".join(d.get("critical_tables") or [])
            d["rules_by_keyword"] = json.dumps(d.get("rules_by_keyword") or {})
            writer.writerow({k: d.get(k, "") for k in fieldnames})

    totals = {
        "files":            len(summaries),
        "ok":               sum(1 for s in summaries if s.status == "ok" and not s.skipped),
        "skipped":          sum(1 for s in summaries if s.skipped),
        "error":            sum(1 for s in summaries if s.status == "error"),
        "total_pages":      sum(s.page_count for s in summaries),
        "total_ocr_pages":  sum(s.ocr_pages for s in summaries),
        "total_tables":     sum(s.tables_extracted for s in summaries),
        "total_rules":      sum(s.rules_extracted for s in summaries),
    }
    json_path.write_text(
        json.dumps({
            "generated_utc": utc_now_iso(),
            "totals": totals,
            "files": [asdict(s) for s in summaries],
        }, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return csv_path, json_path


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def parse_args(argv: list[str] | None = None) -> Config:
    parser = argparse.ArgumentParser(
        description="Batch convert ASME PDFs to human-readable and LLM-optimised Markdown (v2.0).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Output structure (created inside source_dir):
  _human_md/      Column-aware high-fidelity markdown (pymupdf4llm engine)
  _llm_md/        Clause-chunked normative-tagged markdown for LLM injection
  _qa_reports/    Per-file JSON + batch_summary.csv / batch_summary.json

Post-run (make new files visible in Nextcloud UI):
  sudo docker exec -u www-data nextcloud-app php occ files:scan ncadmin
        """,
    )
    parser.add_argument("source_dir", type=Path)
    parser.add_argument("--force",    action="store_true", help="Re-convert even if output is up to date")
    parser.add_argument("--workers",  type=int, default=4, help="Parallel workers (default: 4)")
    parser.add_argument("--skip-ocr", action="store_true", help="Disable OCR for low-text pages")
    parser.add_argument("--verbose",  action="store_true", help="Debug logging")
    args = parser.parse_args(argv)
    return Config(
        source_dir=args.source_dir,
        workers=max(1, args.workers),
        enable_ocr=not args.skip_ocr,
        force=args.force,
        verbose=args.verbose,
    )


def main(argv: list[str] | None = None) -> int:
    cfg = parse_args(argv)
    logging.basicConfig(
        format="%(asctime)s  %(levelname)-7s  %(message)s",
        datefmt="%H:%M:%S",
        level=logging.DEBUG if cfg.verbose else logging.INFO,
    )

    if not cfg.source_dir.is_dir():
        print(f"ERROR: not a directory: {cfg.source_dir}", file=sys.stderr)
        return 2

    pdfs = sorted(
        p for p in cfg.source_dir.glob("*.pdf")
        if p.is_file() and not p.parent.name.startswith("_")
    )
    if not pdfs:
        print(f"No PDF files found in: {cfg.source_dir}", file=sys.stderr)
        return 3

    print(f"Found {len(pdfs)} PDF(s) in {cfg.source_dir}")
    print(f"Engine: pymupdf4llm v{pymupdf4llm.__version__}  |  Workers: {cfg.workers}  |  "
          f"OCR: {'on' if cfg.enable_ocr else 'off'}  |  Force: {cfg.force}")
    print()

    summaries: list[FileSummary] = []
    with ThreadPoolExecutor(max_workers=cfg.workers) as pool:
        future_map = {pool.submit(process_pdf, p, cfg): p for p in pdfs}
        for idx, future in enumerate(as_completed(future_map), start=1):
            s = future.result()
            summaries.append(s)
            flag   = "SKIP" if s.skipped else ("OK  " if s.status == "ok" else "ERR ")
            detail = (f"pg={s.page_count:4d}  h={s.headings_detected:4d}  "
                      f"tbl={s.tables_extracted:3d}  rules={s.rules_extracted:4d}  "
                      f"{s.elapsed_seconds:.1f}s")
            print(f"[{idx:3d}/{len(pdfs)}] {flag}  {Path(s.source_pdf).name:<60s}  {detail}")
            if s.error:
                print(f"           !! {s.error}")

    summaries.sort(key=lambda s: s.source_pdf.lower())
    qa_dir = cfg.source_dir / "_qa_reports"
    csv_path, json_path = write_batch_summary(qa_dir, summaries)

    ok      = sum(1 for s in summaries if s.status == "ok" and not s.skipped)
    skipped = sum(1 for s in summaries if s.skipped)
    errors  = [s for s in summaries if s.status == "error"]

    print()
    print(f"Done.  OK={ok}  SKIP={skipped}  ERR={len(errors)}")
    print(f"Human MD:   {cfg.source_dir / '_human_md'}")
    print(f"LLM MD:     {cfg.source_dir / '_llm_md'}")
    print(f"QA Reports: {qa_dir}")
    if errors:
        print("\nErrors:")
        for s in errors:
            print(f"  {Path(s.source_pdf).name}: {s.error}")
    print()
    print("Post-run (Nextcloud):")
    print("  sudo docker exec -u www-data nextcloud-app php occ files:scan ncadmin")

    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
