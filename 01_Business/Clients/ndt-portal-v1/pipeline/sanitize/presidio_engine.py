"""Six custom Presidio recognizers for NDT engineering documents.

Recognizers:
  1. DrawingNumber   — DWG-12345, A-12345, long numeric IDs
  2. PartNumber      — P/N, PN, Part No. prefixed numbers
  3. CAGECode        — 5-char alphanumeric (labeled via CAGE prefix)
  4. ContractNumber  — DAXX-YY-C-NNNNN, W911SR-21-C-0012 patterns
  5. CertID          — Cert/Certification/Approval IDs
  6. ProjectCode     — Program/Project/PRJ codes
"""
from __future__ import annotations

import re
from presidio_analyzer import Pattern, PatternRecognizer, RecognizerResult
from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider


# ── 1. Drawing Number ──────────────────────────────────────────────────────

class DrawingNumberRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern("DWG prefix",      r"\bDWG[\s\-#:]+[A-Z0-9][\w\-]{3,20}\b",    0.85),
        Pattern("Drawing prefix",  r"\bDRAWING[\s\-#:]+[A-Z0-9][\w\-]{3,20}\b", 0.85),
        Pattern("Dash format",     r"\b[A-Z]{1,3}-\d{5,9}(?:-\d{1,4})?\b",      0.75),
        Pattern("Long numeric",    r"\b\d{8,15}\b",                               0.50),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="DRAWING_NUMBER",
            patterns=self.PATTERNS,
            context=["drawing", "dwg", "print", "blueprint", "revision", "rev"],
            name="DrawingNumberRecognizer",
        )


# ── 2. Part Number ─────────────────────────────────────────────────────────

class PartNumberRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern("P/N prefix",  r"\bP/?N[\s:\-]+[A-Z0-9][\w\-]{3,25}\b",        0.90),
        Pattern("Part No",     r"\bPART\s+NO\.?\s*[:\-]?\s*[A-Z0-9][\w\-]{3,25}\b", 0.90),
        Pattern("PN bare",     r"\bPN[\s:\-]+[A-Z0-9][\w\-]{3,25}\b",           0.80),
        Pattern("NSN",         r"\b\d{4}-\d{2}-\d{3}-\d{4}\b",                  0.95),  # NSN
        Pattern("NIIN",        r"\b\d{2}-\d{3}-\d{4}\b",                         0.90),  # NIIN
    ]

    def __init__(self):
        super().__init__(
            supported_entity="PART_NUMBER",
            patterns=self.PATTERNS,
            context=["part", "p/n", "pn", "nsn", "niin", "item", "stock"],
            name="PartNumberRecognizer",
        )


# ── 3. CAGE Code ──────────────────────────────────────────────────────────

class CAGECodeRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern("CAGE labeled",   r"\bCAGE(?:\s+CODE)?[\s:]+([A-HJ-NP-Z0-9]{5})\b", 0.95),
        Pattern("Company ID",     r"\bCOMPANY\s+ID[\s:]+([A-HJ-NP-Z0-9]{5})\b",     0.90),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="CAGE_CODE",
            patterns=self.PATTERNS,
            context=["cage", "company", "vendor", "manufacturer", "mfr"],
            name="CAGECodeRecognizer",
        )


# ── 4. Contract Number ────────────────────────────────────────────────────

class ContractNumberRecognizer(PatternRecognizer):
    PATTERNS = [
        # Standard DoD contract format: W911SR-21-C-0012, FA8650-20-D-9000
        Pattern("DoD contract",   r"\b[A-Z]{1,2}\d{4}[A-Z]{2}-\d{2}-[CDM]-\d{4}\b", 0.95),
        Pattern("IDIQ order",     r"\b[A-Z]{1,2}\d{4}[A-Z]{2}-\d{2}-[FT]-\d{4,6}\b", 0.90),
        # Contract/PO generic prefixes
        Pattern("Contract prefix",r"\b(?:CONTRACT|PO|PURCHASE\s+ORDER)[\s#:\-]+([A-Z0-9][\w\-]{5,25})\b", 0.85),
        Pattern("Delivery order", r"\bDO[\s#:\-]+([A-Z0-9][\w\-]{4,20})\b",           0.80),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="CONTRACT_NUMBER",
            patterns=self.PATTERNS,
            context=["contract", "po", "purchase order", "delivery order", "task order"],
            name="ContractNumberRecognizer",
        )


# ── 5. Cert ID ────────────────────────────────────────────────────────────

class CertIDRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern("Cert prefix",    r"\bCERT(?:IFICATE|IFICATION)?[\s#:\-]+([A-Z0-9][\w\-]{4,25})\b", 0.85),
        Pattern("Approval ID",    r"\bAPPROVAL[\s#:\-]+([A-Z0-9][\w\-]{4,25})\b",     0.80),
        Pattern("AS9100/9102",    r"\bAS9(?:100|102)[\s#:\-]+([A-Z0-9][\w\-]{4,25})\b", 0.90),
        Pattern("FAA approval",   r"\bFAA\s+(?:DER|PMC|STC|TC)[\s:\-]+([A-Z0-9][\w\-]{4,20})\b", 0.90),
        Pattern("NADCAP",         r"\bNADCAP[\s#:\-]+([A-Z0-9][\w\-]{4,25})\b",        0.90),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="CERT_ID",
            patterns=self.PATTERNS,
            context=["cert", "certificate", "approval", "nadcap", "faa", "qualification"],
            name="CertIDRecognizer",
        )


# ── 6. Project Code ──────────────────────────────────────────────────────

class ProjectCodeRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern("Project prefix",  r"\bPROJECT[\s#:\-]+([A-Z0-9][\w\-]{3,20})\b",  0.85),
        Pattern("Program prefix",  r"\bPROGRAM[\s#:\-]+([A-Z0-9][\w\-]{3,20})\b",  0.85),
        Pattern("PRJ abbreviation",r"\bPRJ[\s#:\-]+([A-Z0-9][\w\-]{3,20})\b",       0.80),
        Pattern("PWS/SOW ref",     r"\b(?:PWS|SOW|WBS)[\s#:\-]+([A-Z0-9][\w\-]{3,20})\b", 0.80),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="PROJECT_CODE",
            patterns=self.PATTERNS,
            context=["project", "program", "wbs", "prj", "sow", "pws"],
            name="ProjectCodeRecognizer",
        )


# ── 7. Email Header ──────────────────────────────────────────────────────

class EmailHeaderRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern("From with name",  r"(?i)\bFrom:\s+[^\n<]{2,80}<[^\s>]+@[^\s>]+>", 0.95),
        Pattern("From bare email", r"(?i)\bFrom:\s+[^\s@]+@[^\s@\n]+",             0.95),
        Pattern("Reply-To header", r"(?i)\bReply-To:\s+.+",                        0.90),
        Pattern("Sender header",   r"(?i)\bSender:\s+.+",                          0.90),
    ]

    def __init__(self):
        super().__init__(
            supported_entity="EMAIL_HEADER",
            patterns=self.PATTERNS,
            name="EmailHeaderRecognizer",
        )


# ── Engine factory ────────────────────────────────────────────────────────

def build_analyzer() -> AnalyzerEngine:
    """Build and return an AnalyzerEngine with all 7 NDT recognizers
    plus Presidio's built-in recognizers (PERSON, PHONE_NUMBER, etc.)."""
    provider = NlpEngineProvider(nlp_configuration={
        "nlp_engine_name": "spacy",
        "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
    })
    nlp_engine = provider.create_engine()

    engine = AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=["en"])
    engine.registry.add_recognizer(DrawingNumberRecognizer())
    engine.registry.add_recognizer(PartNumberRecognizer())
    engine.registry.add_recognizer(CAGECodeRecognizer())
    engine.registry.add_recognizer(ContractNumberRecognizer())
    engine.registry.add_recognizer(CertIDRecognizer())
    engine.registry.add_recognizer(ProjectCodeRecognizer())
    engine.registry.add_recognizer(EmailHeaderRecognizer())

    return engine
