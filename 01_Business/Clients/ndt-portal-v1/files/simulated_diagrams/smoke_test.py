"""
Comply service smoke test — all 6 RT diagrams.
Run on ndtv1: python3 /tmp/smoke_test.py
"""
import base64, json, urllib.request, uuid

COMPLY = "http://localhost:8010"

tests = [
    ("RT-DWG-001-FLAT-PLATE-WELD.pdf",        "DWG-001", "Carbon steel butt weld (simple)"),
    ("RT-DWG-002-PIPE-ELBOW-3-SHOTS.pdf",     "DWG-002", "Pipe elbow 3-shot"),
    ("RT-DWG-003-AERO-BRACKET-4-VIEWS.pdf",   "DWG-003", "Al aerospace bracket 4-view"),
    ("RT-DWG-004-TURBINE-DISK-6-SLICES.pdf",  "DWG-004", "Inconel turbine disk 6-slice"),
    ("RT-DWG-005-NOZZLE-WELD-3-SHOTS.pdf",    "DWG-005", "SS nozzle weld 3-shot"),
    ("RT-DWG-006-FUSELAGE-OVERSIZE-EDGE.pdf", "DWG-006", "Fuselage panel EDGE/OVERSIZE"),
]

print(f"{'DWG':<8} {'Classification':<15} {'Routing':<13} {'Score':>5} {'Text':>6} {'ImgB64':>8} {'MediaType'}")
print("-" * 76)

results = []
for fname, dwgid, label in tests:
    with open(f"/tmp/{fname}", "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    payload = json.dumps({
        "content_b64": b64,
        "filename": fname,
        "intake_id": str(uuid.uuid4()),
    }).encode()
    req = urllib.request.Request(
        f"{COMPLY}/classify",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            resp = json.loads(r.read())
        cls = resp.get("classification", "?")
        rt  = resp.get("llm_routing", "?")
        sc  = resp.get("risk_score", 0)
        tx  = len(resp.get("extracted_text") or "")
        img = len(resp.get("rendered_image_b64") or "")
        mt  = resp.get("rendered_media_type") or "none"
        results.append((dwgid, resp))
        print(f"{dwgid:<8} {cls:<15} {rt:<13} {sc:>5} {tx:>6} {img:>8} {mt}")
    except Exception as e:
        print(f"{dwgid:<8} ERROR: {e}")

# PII check — look for emails and phone-like strings in extracted text
print()
print("PII detection in extracted text:")
for dwgid, resp in results:
    txt = resp.get("extracted_text") or ""
    tokens = txt.split()
    emails = [t for t in tokens if "@" in t and "." in t]
    phones = [t for t in tokens if t.replace("-","").replace(".","").isdigit() and len(t) >= 9]
    pii = emails + phones
    if pii:
        print(f"  {dwgid}: FOUND {pii[:4]}")
    else:
        print(f"  {dwgid}: none in text layer (expect — matplotlib PDF is vector, PII in title block)")

# Routing validation
print()
print("Routing validation:")
expected = {
    "DWG-001": ("EAR_HIGH",      "LOCAL_ONLY"),
    "DWG-002": (None,            "LOCAL_ONLY"),
    "DWG-003": (None,            None),
    "DWG-004": ("ITAR",         "LOCAL_ONLY"),
    "DWG-005": (None,            None),
    "DWG-006": ("NEEDS_REVIEW", "HOLD"),
}
for dwgid, resp in results:
    exp_cls, exp_rt = expected.get(dwgid, (None, None))
    got_cls = resp.get("classification")
    got_rt  = resp.get("llm_routing")
    cls_ok  = exp_cls is None or got_cls == exp_cls
    rt_ok   = exp_rt is None or got_rt == exp_rt
    status  = "PASS" if (cls_ok and rt_ok) else "WARN"
    print(f"  {status} {dwgid}: cls={got_cls} rt={got_rt}")

print()
print("Image wiring check (rendered_image_b64 present):")
for dwgid, resp in results:
    img = resp.get("rendered_image_b64")
    mt  = resp.get("rendered_media_type")
    if img:
        # Decode first 8 bytes to confirm PNG magic
        raw = base64.b64decode(img[:20])
        is_png = raw[:4] == b"\x89PNG"
        print(f"  OK   {dwgid}: {mt}, {len(img)} b64 chars, PNG magic={'yes' if is_png else 'NO'}")
    else:
        print(f"  FAIL {dwgid}: no rendered_image_b64")

print()
print("Done.")
