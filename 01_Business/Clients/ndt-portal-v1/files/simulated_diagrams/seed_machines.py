"""
Seed 4 customer RT machines into the production DB via the local API.
Run on ndtv1: python3 /tmp/seed_machines.py
"""
import json, urllib.request, urllib.error

API = "http://localhost:3100/rt"

MACHINES = [
    {
        "machine_id": "UNIT-1",
        "nickname": "Walk-In (Varian NDI 320/26)",
        "make_model": "Varian / NDI 320/26",
        "spec": {
            "chamber_type": "walk_in",
            "ffd_inches": 64,
            "xray_source": {
                "type": "Industrial X-ray tube",
                "manufacturer": "Varian Medical Systems (now Varex Imaging)",
                "model": "NDI 320/26",
                "max_voltage_kv": 320,
                "max_current_ma": 26,
                "focal_spot_small_mm": 0.4,
                "focal_spot_large_mm": 1.6,
                "beam_cone_angle_deg": 40,
                "target_angle_deg": 20,
                "inherent_filtration_be_mm": 4.0,
                "max_continuous_power_small_w": 560,
                "max_continuous_power_large_w": 2240,
                "cooling_type": "Oil + forced air",
                "target_material": "Tungsten",
                "modality": ["film_rt", "digital_rt", "cr_rt"],
                "recommended_operating_range_kv": [40, 320],
            },
            "manipulation": {
                "axes": ["rotate", "vertical", "horizontal", "tilt"],
                "tilt_available": True,
                "max_load_kg": 150,
                "min_rotation_step_deg": 0.5,
                "ffd_max_mm": 1626,
                "notes": "Walk-in configuration — full 6-axis manipulation. MACH 1 / WALK-IN UNIT per client log.",
            },
            "_supplemented_refs": [
                {"field": "focal_spot_small_mm", "source": "Varex NDI 320/26 datasheet"},
                {"field": "inherent_filtration_be_mm", "source": "Varex NDI 320 product spec"},
                {"field": "beam_cone_angle_deg", "source": "Varex NDI series spec sheet"},
            ],
        },
    },
    {
        "machine_id": "UNIT-2",
        "nickname": "Cabinet (Comet MXR225/22)",
        "make_model": "Comet / MXR225/22",
        "spec": {
            "chamber_type": "classical_cabinet",
            "ffd_inches": None,
            "xray_source": {
                "type": "Industrial X-ray tube",
                "manufacturer": "Comet AG",
                "model": "MXR225/22",
                "max_voltage_kv": 225,
                "max_current_ma": 22,
                "focal_spot_small_mm": 0.4,
                "focal_spot_large_mm": 1.5,
                "beam_cone_angle_deg": 40,
                "target_angle_deg": 20,
                "inherent_filtration_be_mm": 0.8,
                "max_continuous_power_small_w": 360,
                "max_continuous_power_large_w": 1650,
                "cooling_type": "Oil cooled",
                "target_material": "Tungsten",
                "modality": ["film_rt", "digital_rt", "cr_rt"],
                "recommended_operating_range_kv": [30, 225],
                "notes": "Very thin 0.8mm Be filtration — soft spectrum, best for aluminum/light alloys. NOT suitable for steel >30mm.",
            },
            "manipulation": {
                "axes": ["rotate", "vertical", "horizontal"],
                "tilt_available": False,
                "max_load_kg": 50,
                "min_rotation_step_deg": 1.0,
                "ffd_max_mm": 900,
                "notes": "Classical cabinet. Low kV range suits aluminum castings and thin SS.",
            },
            "_supplemented_refs": [
                {"field": "focal_spot_small_mm", "source": "Comet MXR225/22 product datasheet"},
                {"field": "inherent_filtration_be_mm", "source": "Comet MXR225 series technical specs"},
                {"field": "beam_cone_angle_deg", "source": "Comet MXR series spec sheet"},
            ],
        },
    },
    {
        "machine_id": "UNIT-3",
        "nickname": "Cabinet (Comet MXR320/26)",
        "make_model": "Comet / MXR320/26",
        "spec": {
            "chamber_type": "classical_cabinet",
            "ffd_inches": None,
            "xray_source": {
                "type": "Industrial X-ray tube",
                "manufacturer": "Comet AG",
                "model": "MXR320/26",
                "max_voltage_kv": 320,
                "max_current_ma": 26,
                "focal_spot_small_mm": 0.4,
                "focal_spot_large_mm": 1.5,
                "beam_cone_angle_deg": 40,
                "target_angle_deg": 20,
                "inherent_filtration_be_mm": 3.0,
                "max_continuous_power_small_w": 520,
                "max_continuous_power_large_w": 2080,
                "cooling_type": "Oil cooled",
                "target_material": "Tungsten",
                "modality": ["film_rt", "digital_rt", "cr_rt"],
                "recommended_operating_range_kv": [40, 320],
            },
            "manipulation": {
                "axes": ["rotate", "vertical", "horizontal"],
                "tilt_available": False,
                "max_load_kg": 80,
                "min_rotation_step_deg": 1.0,
                "ffd_max_mm": 900,
                "notes": "Classical cabinet. Full 320kV range. 3mm Be filtration — harder beam than MXR225.",
            },
            "_supplemented_refs": [
                {"field": "focal_spot_small_mm", "source": "Comet MXR320/26 product datasheet"},
                {"field": "inherent_filtration_be_mm", "source": "Comet MXR320 technical specs"},
                {"field": "beam_cone_angle_deg", "source": "Comet MXR series spec sheet"},
            ],
        },
    },
    {
        "machine_id": "UNIT-4",
        "nickname": "Cabinet (Varex NDI 320/26)",
        "make_model": "Varex Imaging / NDI 320/26",
        "spec": {
            "chamber_type": "classical_cabinet",
            "ffd_inches": None,
            "xray_source": {
                "type": "Industrial X-ray tube",
                "manufacturer": "Varex Imaging (formerly Varian)",
                "model": "NDI 320/26",
                "max_voltage_kv": 320,
                "max_current_ma": 26,
                "focal_spot_small_mm": 0.4,
                "focal_spot_large_mm": 1.6,
                "beam_cone_angle_deg": 40,
                "target_angle_deg": 20,
                "inherent_filtration_be_mm": 4.0,
                "max_continuous_power_small_w": 560,
                "max_continuous_power_large_w": 2240,
                "cooling_type": "Oil + forced air",
                "target_material": "Tungsten",
                "modality": ["film_rt", "digital_rt", "cr_rt"],
                "recommended_operating_range_kv": [40, 320],
                "notes": "Identical tube to UNIT-1. Varex acquired Varian imaging division 2017 — same product, different branding.",
            },
            "manipulation": {
                "axes": ["rotate", "vertical", "horizontal"],
                "tilt_available": True,
                "max_load_kg": 100,
                "min_rotation_step_deg": 0.5,
                "ffd_max_mm": 1200,
                "notes": "Cabinet variant of NDI 320/26. More confined than walk-in but same tube/kV capability.",
            },
            "_supplemented_refs": [
                {"field": "focal_spot_small_mm", "source": "Varex NDI 320/26 datasheet (same as UNIT-1)"},
                {"field": "inherent_filtration_be_mm", "source": "Varex NDI 320 product spec"},
            ],
        },
    },
]


def post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{API}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


for m in MACHINES:
    mid = m["machine_id"]
    status, resp = post("/machines", m)
    if status in (200, 201):
        print(f"  OK  {mid} — {m['nickname']} (id={resp.get('id','?')[:8]}...)")
    elif status == 409:
        print(f"  SKIP {mid} — already exists")
    else:
        print(f"  FAIL {mid} — HTTP {status}: {resp}")

print("\nFinal machine list:")
req = urllib.request.Request(f"{API}/machines")
with urllib.request.urlopen(req, timeout=10) as r:
    machines = json.loads(r.read())
for m in machines:
    print(f"  {m['machine_id']:8s}  {m['nickname']}")
