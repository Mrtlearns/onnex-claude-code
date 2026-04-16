"""ITAR/EAR/MIL-SPEC keyword scanner.

Scans extracted document text for controlled-technology indicators and
returns a list of hits with weights for risk scoring.
Supplements DB keywords loaded at startup.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# ── Built-in keyword library (baseline — DB keywords are additive) ──────────
#   (keyword_pattern, category, weight, description)
_BUILTIN: list[tuple[str, str, int, str]] = [
    # Distribution statements — highest priority
    (r"DISTRIBUTION STATEMENT [D-F]", "ITAR", 30, "Restricted distribution statement"),
    (r"DISTRIBUTION STATEMENT X",     "ITAR", 30, "Prohibited distribution"),
    (r"NOFORN",                        "ITAR", 25, "No Foreign Nationals"),
    (r"ITAR CONTROLLED",               "ITAR", 25, "Explicit ITAR marking"),
    (r"EXPORT CONTROLLED",             "ITAR", 20, "Generic export control marking"),
    (r"EXPORT CONTROL",                "ITAR", 20, "Generic export control marking"),

    # USML categories
    (r"USML\s+CATEGORY",  "USML", 20, "USML category reference"),
    (r"22\s+CFR\s+120",   "USML", 20, "ITAR regulation cite"),
    (r"22\s+CFR\s+121",   "USML", 25, "USML regulation cite"),
    (r"15\s+CFR\s+730",   "EAR",  15, "EAR regulation cite"),
    (r"15\s+CFR\s+774",   "EAR",  15, "Commerce Control List cite"),
    (r"EAR99",             "EAR",   3, "EAR99 classification (low)"),
    (r"ECCN\s+[0-9][A-Z][0-9]{3}", "EAR", 10, "ECCN classification"),

    # USML categories I–XXI
    (r"CATEGORY\s+I\b",    "USML", 20, "Firearms USML"),
    (r"CATEGORY\s+II\b",   "USML", 20, "Artillery USML"),
    (r"CATEGORY\s+III\b",  "USML", 20, "Ammunition USML"),
    (r"CATEGORY\s+IV\b",   "USML", 20, "Launch vehicles USML"),
    (r"CATEGORY\s+V\b",    "USML", 20, "Explosives USML"),
    (r"CATEGORY\s+VI\b",   "USML", 25, "Naval vessels USML"),
    (r"CATEGORY\s+VII\b",  "USML", 25, "Military vehicles USML"),
    (r"CATEGORY\s+VIII\b", "USML", 25, "Aircraft USML"),
    (r"CATEGORY\s+IX\b",   "USML", 20, "Military training USML"),
    (r"CATEGORY\s+X\b",    "USML", 20, "Personal equipment USML"),
    (r"CATEGORY\s+XI\b",   "USML", 25, "Electronics USML"),
    (r"CATEGORY\s+XII\b",  "USML", 25, "Fire control USML"),
    (r"CATEGORY\s+XIII\b", "USML", 25, "Materials USML"),
    (r"CATEGORY\s+XIV\b",  "USML", 20, "Toxics USML"),
    (r"CATEGORY\s+XV\b",   "USML", 25, "Spacecraft USML"),
    (r"CATEGORY\s+XVI\b",  "USML", 20, "Nuclear USML"),
    (r"CATEGORY\s+XVII\b", "USML", 20, "Classified USML"),
    (r"CATEGORY\s+XVIII\b","USML", 25, "Directed energy USML"),
    (r"CATEGORY\s+XIX\b",  "USML", 25, "Gas turbines USML"),
    (r"CATEGORY\s+XX\b",   "USML", 20, "Submersible vehicles USML"),
    (r"CATEGORY\s+XXI\b",  "USML", 20, "Miscellaneous articles USML"),

    # MIL-SPEC standards
    (r"MIL-STD-\d+",   "MIL_SPEC", 5,  "Military standard"),
    (r"MIL-SPEC",       "MIL_SPEC", 5,  "Military specification reference"),
    (r"MIL-DTL-\d+",   "MIL_SPEC", 5,  "Military detail specification"),
    (r"MIL-PRF-\d+",   "MIL_SPEC", 5,  "Military performance specification"),
    (r"MIL-HDBK-\d+",  "MIL_SPEC", 3,  "Military handbook"),
    (r"MIL-A-\d+",     "MIL_SPEC", 5,  "Military specification (armor/aircraft)"),
    (r"MIL-T-\d+",     "MIL_SPEC", 5,  "Military specification (test)"),
    (r"MIL-C-\d+",     "MIL_SPEC", 5,  "Military specification (connector)"),

    # Defense program indicators
    (r"F-35\b",            "ITAR", 20, "F-35 Joint Strike Fighter"),
    (r"F-22\b",            "ITAR", 20, "F-22 Raptor"),
    (r"AH-64\b",           "ITAR", 20, "Apache helicopter"),
    (r"UH-60\b",           "ITAR", 15, "Black Hawk helicopter"),
    (r"CH-47\b",           "ITAR", 15, "Chinook helicopter"),
    (r"V-22\b",            "ITAR", 20, "Osprey tiltrotor"),
    (r"B-2\b",             "ITAR", 25, "B-2 stealth bomber"),
    (r"JASSM",             "ITAR", 25, "Joint Air-to-Surface Standoff Missile"),
    (r"HIMARS",            "ITAR", 25, "High Mobility Artillery Rocket System"),
    (r"PATRIOT\s+MISSILE", "ITAR", 25, "Patriot missile system"),
    (r"JAVELIN",           "ITAR", 25, "Javelin anti-tank missile"),
    (r"STINGER",           "ITAR", 25, "Stinger MANPADS"),
    (r"AEGIS",             "ITAR", 20, "Aegis combat system"),

    # Contract / program office indicators
    (r"DCAA",  "EAR", 8,  "Defense Contract Audit Agency"),
    (r"DCMA",  "EAR", 8,  "Defense Contract Management Agency"),
    (r"DPAS",  "EAR", 8,  "Defense Priorities and Allocations System"),
    (r"DD-250","EAR", 8,  "Material Inspection and Receiving Report"),
    (r"DD\s+1423","EAR", 8, "Contract Data Requirements List"),
    (r"CDRL",  "EAR", 8,  "Contract Data Requirements List"),
    (r"CLIN",  "EAR", 5,  "Contract Line Item Number"),
    (r"DID\s+\w{2,8}-\d+", "EAR", 5, "Data Item Description"),

    # Sensitive materials / processes
    (r"CLASSIFIED",            "ITAR", 30, "Classification marking"),
    (r"SECRET",                "ITAR", 30, "Classification level"),
    (r"TOP\s+SECRET",          "ITAR", 30, "Classification level"),
    (r"CONTROLLED\s+UNCLASSIFIED", "ITAR", 15, "CUI marking"),
    (r"CUI\b",                 "ITAR", 15, "Controlled Unclassified Information"),
    (r"FOUO\b",                "ITAR", 10, "For Official Use Only"),
    (r"STEALTH",               "ITAR", 20, "Stealth technology indicator"),
    (r"LOW\s+OBSERVABLE",      "ITAR", 20, "Stealth/LO technology"),
    (r"RAM\s+COATING",         "ITAR", 20, "Radar-absorbing material"),
    (r"DEPLETED\s+URANIUM",    "ITAR", 25, "DU munitions"),
    (r"SHAPED\s+CHARGE",       "ITAR", 25, "Explosive device component"),
    (r"THERMOBARIC",           "ITAR", 25, "Thermobaric explosive"),
    (r"PROPELLANT",            "EAR",  10, "Propellant (may be dual-use)"),
    (r"HIGH\s+EXPLOSIVE",      "ITAR", 25, "High explosive reference"),
]

# Pre-compiled patterns
_COMPILED: list[tuple[re.Pattern, str, int, str]] = [
    (re.compile(pat, re.IGNORECASE), cat, weight, desc)
    for pat, cat, weight, desc in _BUILTIN
]


@dataclass
class KeywordHit:
    pattern:  str
    category: str
    weight:   int
    match:    str
    position: int


def scan_text(text: str, db_keywords: list[dict] | None = None) -> list[KeywordHit]:
    """Scan text for ITAR/EAR/MIL-SPEC keywords.

    Args:
        text:         Document text (upper-case recommended for best matching).
        db_keywords:  Additional keywords loaded from DB (list of dicts with
                      keys: keyword, category, weight, description).

    Returns:
        List of KeywordHit for every match found (duplicates allowed — scored per hit).
    """
    hits: list[KeywordHit] = []
    text_upper = text.upper()

    # Built-in patterns
    for pattern, category, weight, desc in _COMPILED:
        for m in pattern.finditer(text_upper):
            hits.append(KeywordHit(
                pattern=pattern.pattern,
                category=category,
                weight=weight,
                match=m.group(0),
                position=m.start(),
            ))

    # DB-loaded keywords (plain string matching, not regex)
    if db_keywords:
        for kw in db_keywords:
            keyword = kw["keyword"].upper()
            pos = 0
            while True:
                idx = text_upper.find(keyword, pos)
                if idx == -1:
                    break
                hits.append(KeywordHit(
                    pattern=keyword,
                    category=kw["category"],
                    weight=kw["weight"],
                    match=kw["keyword"],
                    position=idx,
                ))
                pos = idx + len(keyword)

    return hits
