"""
Smoke test for SPRS Excel + Audit Package ZIP endpoints.

Requires: HASURA_ADMIN_SECRET set (to find program ID) or hardcode known program ID.
Uses Canopy Aerospace program (ba8d74d0) or discovers first available program.
"""
from __future__ import annotations

import sys
import os
import json
import time
import urllib.request
import urllib.error

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

API_BASE = "https://api.cmmc4msp.on-nex.us"
GQL_URL  = "https://gql.cmmc4msp.on-nex.us/v1/graphql"

# Use the Canopy program ID from current-data.md
PROGRAM_ID = "ba8d74d0-0000-0000-0000-000000000000"  # placeholder — resolved below

HASURA_ADMIN_SECRET = os.environ.get("HASURA_ADMIN_SECRET", "")


def gql(query: str, variables: dict | None = None) -> dict:
    payload = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(
        GQL_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
        },
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


WEBHOOK_SECRET = os.environ.get(
    "WEBHOOK_SECRET",
    "87108b32f2db65523ed58d3c429a27e3a7ed8f038f923f090348802036e0c77b",
)


def post_api(path: str, token: str | None = None) -> tuple[int, dict]:
    headers: dict[str, str] = {
        "Content-Type": "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET,
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=b"{}",
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        return e.code, {"error": body}


def check(label: str, ok: bool, detail: str = "") -> None:
    icon = "[OK]    " if ok else "[FAILED]"
    print(f"  {icon}  {label}", flush=True)
    if detail:
        print(f"           {detail}", flush=True)
    if not ok:
        global _any_fail
        _any_fail = True


_any_fail = False


def main() -> None:
    global _any_fail

    # ── 0. Health check ───────────────────────────────────────────────────────
    print("\n=== Step 0: FastAPI health ===")
    try:
        with urllib.request.urlopen(f"{API_BASE}/health/deep", timeout=10) as r:
            body = json.loads(r.read())
            db_ok = body.get("components", {}).get("postgres") == "up" or body.get("db") == "up"
        check("GET /health/deep  (db: up)", db_ok, str(body))
    except Exception as e:
        check("GET /health/deep", False, str(e))
        print("Cannot reach API — aborting.", file=sys.stderr)
        sys.exit(1)

    # ── 1. Discover program ID ────────────────────────────────────────────────
    print("\n=== Step 1: Resolve program ID ===")
    program_id = None
    if HASURA_ADMIN_SECRET:
        try:
            result = gql("query { programs(limit: 1, order_by: {created_at: asc}) { id name } }")
            progs = result.get("data", {}).get("programs", [])
            if progs:
                program_id = progs[0]["id"]
                print(f"  Found program: {progs[0]['name']} ({program_id})")
        except Exception as e:
            print(f"  GQL lookup failed: {e}")

    if not program_id:
        # Fallback: use known Canopy program
        program_id = "ba8d74d0-cff7-46ea-a24b-68355cf2e991"
        print(f"  Using hardcoded Canopy program: {program_id}")

    # ── 2. SPRS sheet ─────────────────────────────────────────────────────────
    print("\n=== Step 2: POST /api/reports/{id}/sprs-sheet ===")
    t0 = time.monotonic()
    status, body = post_api(f"/api/reports/{program_id}/sprs-sheet")
    elapsed = time.monotonic() - t0
    print(f"  HTTP {status} in {elapsed:.1f}s")
    sprs_ok = status == 200 and "download_url" in body
    check("SPRS sheet endpoint returned 200 + download_url", sprs_ok, json.dumps(body)[:300])
    if sprs_ok:
        dl_url = body["download_url"]
        check("download_url is non-empty", bool(dl_url), dl_url[:80] if dl_url else "")
        # Try fetching the signed download URL
        try:
            req = urllib.request.Request(dl_url, method="GET")
            with urllib.request.urlopen(req, timeout=30) as r:
                content = r.read()
                check(
                    f"Download URL returns bytes (xlsx magic)",
                    content[:4] == b"PK\x03\x04",  # ZIP/xlsx magic
                    f"{len(content)} bytes, starts: {content[:8].hex()}",
                )
        except Exception as e:
            check("Download URL fetch", False, str(e))

    # ── 3. Audit package ──────────────────────────────────────────────────────
    print("\n=== Step 3: POST /api/reports/{id}/audit-package ===")
    t0 = time.monotonic()
    status, body = post_api(f"/api/reports/{program_id}/audit-package")
    elapsed = time.monotonic() - t0
    print(f"  HTTP {status} in {elapsed:.1f}s")
    zip_ok = status == 200 and "download_url" in body
    check("Audit package endpoint returned 200 + download_url", zip_ok, json.dumps(body)[:300])
    if zip_ok:
        dl_url = body["download_url"]
        check("download_url is non-empty", bool(dl_url), dl_url[:80] if dl_url else "")
        try:
            req = urllib.request.Request(dl_url, method="GET")
            with urllib.request.urlopen(req, timeout=60) as r:
                content = r.read()
                check(
                    f"Download URL returns ZIP ({len(content)} bytes)",
                    content[:4] == b"PK\x03\x04",
                    f"starts: {content[:8].hex()}",
                )
        except Exception as e:
            check("Download URL fetch", False, str(e))

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'='*50}")
    if _any_fail:
        print("  RESULT: SOME TESTS FAILED — see [FAILED] lines above")
        sys.exit(1)
    else:
        print("  RESULT: ALL TESTS PASSED")


if __name__ == "__main__":
    main()
