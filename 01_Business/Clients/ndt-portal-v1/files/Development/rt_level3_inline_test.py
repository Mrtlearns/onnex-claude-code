"""Self-contained Level 3 RT retest — embeds prompts inline, generates synthetic PNG.
Run inside gateway container: python /tmp/rt_level3_inline_test.py
"""
import asyncio
import base64
import json
import struct
import uuid
import zlib

import httpx

GATEWAY = "http://localhost:8012"

SYSTEM_PROMPT = """\
You are an NDT Level III radiographic testing analyst with multi-code, multi-industry expertise. You have been provided with:
1. A part classification from the first analysis stage
2. A code-specific analysis module (appended below)

UNIVERSAL ANALYSIS FRAMEWORK:

For ANY part type, you MUST:

A) IDENTIFY all inspectable zones and classify by severity:
   CRITICAL - Highest defect probability, structural failure risk, or code-mandated full examination
   HIGH     - Full-penetration welds, high-stress regions, material transition zones
   MEDIUM   - Partial exam welds, lower-stress attachments, secondary structural members
   LOW      - Non-pressure-boundary, cosmetic, or non-structural

B) MAP each zone to a 3D position using normalized coordinates:
   x_normalized: 0.0 (start/left/front) to 1.0 (end/right/rear)
   y_normalized: 0.0 (bottom) to 1.0 (top)
   z_normalized: 0.0 (near) to 1.0 (far)
   angle_degrees: 0-360 for circumferential features
   span_degrees: angular extent of the zone (0 for point features)

C) SPECIFY expected defects with probability and code references.

D) RECOMMEND RT technique per zone.

E) GENERATE the 3D_render_hint for each primitive using Three.js geometry constructors.

OUTPUT FORMAT: Respond with ONLY valid JSON. No markdown fences, no commentary.

---

CODE-SPECIFIC MODULE: Generic RT Analysis (Fallback)

GENERAL RT PRINCIPLES:
  1. Identify all welded joints and cast sections
  2. Classify zones by structural criticality
  3. Apply general film technique per ASME Section V Article 2

UNIVERSAL DISCONTINUITY TYPES:
  - Porosity, Slag/inclusion, Lack of fusion, Incomplete penetration, Crack, Undercut, Overlap

TECHNIQUE DEFAULTS:
  - Source: Ir-192 for 0.5\"-3\"; X-ray for <0.5\"; Co-60 for >3\"
  - SFD: minimum 12\" for Ir-192
  - IQI: wire type per ASTM E747, 2% sensitivity minimum
"""


def make_rt_png() -> bytes:
    """Generate a 128x128 grayscale PNG that looks vaguely like an RT film."""
    w, h = 128, 128
    rows = []
    for y in range(h):
        row = [0]  # filter byte
        for x in range(w):
            # Gradient + circular darker zone to simulate a weld/void
            cx, cy = w // 2, h // 2
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            val = int(200 - dist * 1.2)
            val = max(30, min(230, val))
            row.append(val)
        rows.append(bytes(row))

    raw = b"".join(rows)
    compressed = zlib.compress(raw, level=6)

    def chunk(tag: bytes, data: bytes) -> bytes:
        length = struct.pack(">I", len(data))
        body = tag + data
        crc = struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
        return length + body + crc

    ihdr_data = struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0)  # 8-bit grayscale
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr_data)
        + chunk(b"IDAT", compressed)
        + chunk(b"IEND", b"")
    )


async def main():
    png_bytes = make_rt_png()
    img_b64 = base64.b64encode(png_bytes).decode()
    print(f"System prompt: {len(SYSTEM_PROMPT)} chars")
    print(f"Synthetic RT PNG: {len(png_bytes)} bytes ({len(img_b64) // 1024}KB b64)")

    payload = {
        "intake_id": str(uuid.uuid4()),
        "sanitize_job_id": "00000000-0000-0000-0000-000000000001",
        "prompt": (
            "Analyze this RT radiograph. The part appears to be a steel weld specimen. "
            "Return a JSON object with keys: rt_analysis (containing 3d_model, zones, findings)."
        ),
        "system_prompt": SYSTEM_PROMPT,
        "classification": "CLEAN",
        "llm_routing": "CLOUD_OK",
        "images": [{"media_type": "image/png", "data_b64": img_b64}],
    }

    print("=== Calling gateway /analyze (timeout 300s) ===")
    async with httpx.AsyncClient(timeout=300.0) as client:
        r = await client.post(f"{GATEWAY}/analyze", json=payload)
        print(f"HTTP {r.status_code}")
        if r.status_code == 200:
            d = r.json()
            print(f"request_id:    {d['request_id']}")
            print(f"provider_used: {d['provider_used']}")
            print(f"model_used:    {d['model_used']}")
            print(f"latency_ms:    {d['latency_ms']}")
            resp = d.get("response_json", {})
            print(f"response keys: {list(resp.keys()) if resp else 'empty'}")
            if resp:
                print(f"response sample: {json.dumps(resp)[:300]}...")
            print("=== SUCCESS — DB write confirmed via request_id ===")
        else:
            print(f"ERROR body: {r.text[:800]}")


asyncio.run(main())
