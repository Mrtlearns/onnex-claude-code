# PDF to Markdown — ASME Spec Batch Converter

Converts a directory of ASME technical PDF standards into two Markdown variants per file:

| Output dir | Purpose |
|------------|---------|
| `_human_md/` | High-fidelity structured markdown — headings, clause numbering, tables, page anchors. For human review and QA. |
| `_llm_md/`   | Clause-chunked, normative-tagged markdown — each ASME clause is a self-contained `##` block with `[SHALL]`/`[SHOULD]`/etc. tags and severity ratings. For LLM prompt injection. |
| `_qa_reports/` | Per-file JSON reports + batch summary CSV/JSON. |

## Installation

```bash
pip install -r tools/pdf_to_markdown/requirements.txt
```

Install Tesseract OCR (required for scanned/mixed PDFs):

```bash
# Ubuntu/Debian (ndtv1 server)
sudo apt-get install tesseract-ocr

# macOS
brew install tesseract

# Windows — download installer from:
# https://github.com/UB-Mannheim/tesseract/wiki
```

## Usage

### On the ndtv1 server (preferred — direct filesystem access)

```bash
# Convert all ASME PDFs in the Nextcloud folder
python3 tools/pdf_to_markdown/convert.py \
    "/mnt/nextcloud-data/ncadmin/files/90_NDT Governing Specifications/ASME Specifications/"

# Force re-conversion of all files (even if output is already up to date)
python3 tools/pdf_to_markdown/convert.py --force \
    "/mnt/nextcloud-data/ncadmin/files/90_NDT Governing Specifications/ASME Specifications/"

# Faster run — skip OCR (born-digital PDFs only, no scanned pages)
python3 tools/pdf_to_markdown/convert.py --skip-ocr --workers 6 \
    "/mnt/nextcloud-data/ncadmin/files/90_NDT Governing Specifications/ASME Specifications/"
```

After the run, make the new markdown files visible in the Nextcloud portal UI:

```bash
sudo docker exec -u www-data nextcloud-app php occ files:scan ncadmin
```

### Local testing (Windows WSL2 or macOS)

```bash
python3 tools/pdf_to_markdown/convert.py --workers 2 /path/to/local/asme_pdfs/
```

## CLI Options

```
usage: convert.py [-h] [--force] [--workers N] [--skip-ocr] [--verbose] source_dir

positional arguments:
  source_dir    Directory containing PDF files (outputs go inside it)

options:
  --force       Re-convert even if output is newer than source PDF
  --workers N   Parallel workers (default: 4)
  --skip-ocr    Skip OCR for low-text/scanned pages (faster, may miss content)
  --verbose     Debug-level logging
```

## Output Structure

```
ASME Specifications/
├── ASME_BPVC_VIII-1_2023.pdf
├── ASME_B31.3_2022.pdf
├── ...
├── _human_md/
│   ├── ASME_BPVC_VIII-1_2023.md
│   ├── ASME_B31.3_2022.md
│   └── ...
├── _llm_md/
│   ├── ASME_BPVC_VIII-1_2023.md
│   ├── ASME_B31.3_2022.md
│   └── ...
└── _qa_reports/
    ├── ASME_BPVC_VIII-1_2023_report.json
    ├── ASME_B31.3_2022_report.json
    ├── batch_summary.csv
    └── batch_summary.json
```

## Human Markdown Format

```markdown
---
title: "ASME BPVC Section VIII Division 1"
code: "BPVC VIII-1"
edition: "2023"
pages: 432
method: "born_digital"
---

# ASME BPVC Section VIII Division 1

<!-- page:42 -->

## UW-11 Radiographic Examination

Body text of the clause...

#### Table UW-12 (page 43)
| Category | Joint Type | RT Extent |
|----------|-----------|-----------|
| A        | Butt       | Full      |
```

## LLM Markdown Format

Each ASME clause becomes a self-contained `##` block:

```markdown
## UW-11 Radiographic Examination

### Context
- Code: BPVC VIII-1
- Part: Requirements for Pressure Vessels Fabricated by Welding
- Scope: Determines extent of radiographic examination required
- Source page: 42

### Rules
- **[SHALL]** All butt welds in vessels designed for lethal service per UG-20 shall be fully radiographed. [Severity: CRITICAL]
- **[SHALL]** Butt welds where E = 1.0 shall be fully radiographed. [Severity: HIGH]
- **[MAY]** Spot radiography may be substituted when E = 0.85. [Severity: LOW]

### Tables
#### Table UW-12 (page 43)
| Category | ...

### Cross-References
- UW-51
- UG-20
- Appendix 4
```

## Idempotency

By default the script skips a PDF if both `_human_md/{stem}.md` and `_llm_md/{stem}.md` already exist and are newer than the source PDF. Use `--force` to override.

## QA Review

After a run, check `_qa_reports/batch_summary.csv` for:
- `status=error` — conversion failed, needs investigation
- High `ocr_pages` count — quality may be lower for scanned pages
- Low `rules_extracted` count (< 10) — normative content may not have been extracted correctly
- `critical_tables` column — manually verify tables flagged as critical (UW-12, UCS-66, etc.)

## Future Integration

The `_llm_md/` output is designed for injection into the portal's Stage 2 LLM pipeline via `api/src/lib/prompt-assembler.ts`. Each `##` clause block is independently selectable — the assembler can load only relevant clauses (e.g., UW-11 + UW-51 for ASME VIII vessel analysis) without including the entire spec.

The `app.folder_references` table already maps aliases to Nextcloud paths. Adding a row pointing to `_llm_md/` will enable this future integration without modifying the converter.
