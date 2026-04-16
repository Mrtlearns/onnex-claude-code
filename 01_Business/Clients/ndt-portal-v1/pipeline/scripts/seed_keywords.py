#!/usr/bin/env python3
"""Seed the comply_keyword_library and comply_cage_code_registry tables.

Usage:
    PG_DSN="postgresql://ndtapp:Ndt%40P0rtal2026!@localhost:5432/ndtportal" python seed_keywords.py

Run after the schema migration. Idempotent — uses ON CONFLICT DO NOTHING.
"""
from __future__ import annotations

import asyncio
import os
import asyncpg

# ── ITAR/EAR/MIL-SPEC keywords ────────────────────────────────────────────
# (keyword, category, weight, description)
KEYWORDS: list[tuple[str, str, int, str]] = [
    # Additional USML/ITAR keywords (supplement to built-ins in keyword_scanner.py)
    ("MUNITIONS LIST",          "ITAR",    25, "USML reference"),
    ("ARMS EXPORT CONTROL",     "ITAR",    20, "AECA reference"),
    ("DIRECTORATE OF DEFENSE",  "ITAR",    15, "DDTC reference"),
    ("DDTC",                    "ITAR",    15, "Directorate of Defense Trade Controls"),
    ("DSP-73",                  "ITAR",    20, "ITAR export license form"),
    ("DSP-5",                   "ITAR",    20, "ITAR export license form"),
    ("TAA",                     "ITAR",    10, "Technical Assistance Agreement"),
    ("MLA",                     "ITAR",    10, "Manufacturing License Agreement"),
    ("EXPORT LICENSE",          "ITAR",    15, "Export license indicator"),
    # EAR/CCL keywords
    ("COMMERCE CONTROL LIST",   "EAR",     15, "CCL reference"),
    ("DUAL USE",                "EAR",      8, "Dual-use technology"),
    ("BIS LICENSE",             "EAR",     10, "Bureau of Industry and Security"),
    ("LICENSE EXCEPTION",       "EAR",      5, "EAR license exception"),
    ("NO LICENSE REQUIRED",     "EAR",      2, "NLR designation"),
    # MIL-SPEC keywords (supplement keyword_scanner built-ins)
    ("MILITARY SPECIFICATION",  "MIL_SPEC", 5, "General MIL-SPEC reference"),
    ("DEF STAN",                "MIL_SPEC", 5, "UK Defence Standard"),
    ("STANAG",                  "MIL_SPEC", 8, "NATO standardization agreement"),
    ("AMS 2750",                "MIL_SPEC", 5, "Aerospace pyrometry standard"),
    ("AMS 2769",                "MIL_SPEC", 5, "Heat treatment in vacuum"),
    ("AMS 2680",                "MIL_SPEC", 5, "Electron beam welding"),
    ("ASTM E1742",              "MIL_SPEC", 3, "Radiographic testing standard"),
    ("ASTM E2033",              "MIL_SPEC", 3, "Computed radiography"),
    ("NAS 410",                 "MIL_SPEC", 5, "NDT personnel certification"),
    ("SNT-TC-1A",               "MIL_SPEC", 5, "ASNT NDT personnel qualification"),
    ("AWS D1.1",                "MIL_SPEC", 3, "Structural welding code"),
    ("ASME SEC V",              "MIL_SPEC", 3, "ASME NDE standard"),
    ("NAVSEA S9074",            "MIL_SPEC", 8, "Naval NDE specification"),
    ("MIL-I-6866",              "MIL_SPEC", 5, "Military NDE specification"),
    ("MIL-I-6870",              "MIL_SPEC", 5, "Military NDE specification"),
    ("T-51",                    "MIL_SPEC", 3, "ASME NDE technique"),
    ("CLASS C",                 "MIL_SPEC", 3, "Quality classification"),
    ("CLASS D",                 "MIL_SPEC", 5, "Quality classification"),
    # Sensitive materials
    ("TITANIUM ALLOY",          "EAR",      5, "Controlled material"),
    ("CARBON FIBER",            "EAR",      5, "Dual-use composite"),
    ("KEVLAR",                  "EAR",      5, "Controlled fiber"),
    ("MARAGING STEEL",          "EAR",      8, "High-strength controlled steel"),
    ("INCONEL 718",             "EAR",      5, "Aerospace superalloy"),
    ("WASPALOY",                "EAR",      5, "Aerospace superalloy"),
    ("RENE 41",                 "EAR",      5, "Aerospace superalloy"),
    ("BERYLLIUM",               "ITAR",    15, "Controlled material (toxicity+ITAR)"),
    ("DEPLETED URANIUM",        "ITAR",    25, "DU material"),
    ("NITINOL",                 "EAR",      5, "Shape memory alloy"),
    # Defense program terms
    ("BLACK PROGRAM",           "ITAR",    30, "Classified program indicator"),
    ("SPECIAL ACCESS PROGRAM",  "ITAR",    30, "SAP classification"),
    ("SAP",                     "ITAR",    10, "Special Access Program (context-dependent)"),
    ("SCI",                     "ITAR",    20, "Sensitive Compartmented Information"),
    ("WAIVER",                  "EAR",      3, "Export waiver"),
]

# ── Known defense contractor CAGE codes ───────────────────────────────────
# Format: (cage_code, company, country, is_defense)
CAGE_CODES: list[tuple[str, str, str, bool]] = [
    ("97480", "Lockheed Martin Corporation",           "US", True),
    ("77445", "Boeing Company",                        "US", True),
    ("21468", "Raytheon Technologies Corporation",     "US", True),
    ("16826", "General Dynamics Corporation",          "US", True),
    ("K0VH8", "BAE Systems",                          "GB", True),
    ("07083", "Northrop Grumman Corporation",          "US", True),
    ("99089", "L3Harris Technologies",                 "US", True),
    ("55299", "Textron Inc.",                          "US", True),
    ("56418", "General Electric Aviation",             "US", True),
    ("58694", "Rolls-Royce",                           "GB", True),
    ("70168", "Pratt & Whitney",                       "US", True),
    ("80205", "Honeywell International",               "US", True),
    ("75272", "United Technologies Corporation",       "US", True),
    ("99206", "SAIC",                                  "US", True),
    ("08732", "Leidos Holdings",                       "US", True),
    ("18876", "TransDigm Group",                       "US", True),
    ("26512", "Spirit AeroSystems",                    "US", True),
    ("30038", "DRS Technologies",                      "US", True),
    ("18876", "TransDigm Group",                       "US", True),
    ("0MNK4", "Safran Group",                          "FR", True),
    ("3AJU7", "Airbus Defence and Space",              "DE", True),
    ("55551", "Sikorsky Aircraft Corporation",         "US", True),
    ("26704", "Bell Textron",                          "US", True),
    ("45118", "Leonardo DRS",                          "US", True),
    ("69474", "FLIR Systems",                          "US", True),
]


async def main():
    dsn = os.environ["PG_DSN"]
    pool = await asyncpg.create_pool(dsn)

    async with pool.acquire() as conn:
        # Keywords
        for keyword, category, weight, description in KEYWORDS:
            await conn.execute(
                """
                INSERT INTO pipeline.comply_keyword_library
                    (keyword, category, weight, description)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (keyword) DO UPDATE
                    SET category=EXCLUDED.category,
                        weight=EXCLUDED.weight,
                        description=EXCLUDED.description
                """,
                keyword, category, weight, description,
            )
        print(f"Seeded {len(KEYWORDS)} keywords")

        # CAGE codes
        inserted = 0
        for cage_code, company, country, is_defense in CAGE_CODES:
            result = await conn.execute(
                """
                INSERT INTO pipeline.comply_cage_code_registry
                    (cage_code, company, country, is_defense)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (cage_code) DO NOTHING
                """,
                cage_code.ljust(5), company, country, is_defense,
            )
            if result == "INSERT 0 1":
                inserted += 1
        print(f"Seeded {inserted} CAGE codes (skipped duplicates)")

    await pool.close()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
