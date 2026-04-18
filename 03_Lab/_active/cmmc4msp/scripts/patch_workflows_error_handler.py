"""Patch all n8n workflows (01-15) to reference WF16 as their error workflow."""
import json
import os
import sys

ERROR_WORKFLOW_ID = "a1b2c3d4-0016-0016-0016-000000000000"

WORKFLOWS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "n8n", "workflows"
)


def patch_file(path: str) -> bool:
    """Patch a single workflow file. Returns True if file was modified."""
    with open(path, "rb") as f:
        raw = f.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"  SKIP (invalid JSON - {exc}): {os.path.basename(path)}")
        return False

    # Skip WF16 itself
    wf_id = data.get("id", "")
    if wf_id == ERROR_WORKFLOW_ID:
        print(f"  SKIP (is error handler): {os.path.basename(path)}")
        return False

    modified = False

    if "settings" not in data:
        data["settings"] = {"errorWorkflow": ERROR_WORKFLOW_ID}
        modified = True
    elif data["settings"].get("errorWorkflow") != ERROR_WORKFLOW_ID:
        data["settings"]["errorWorkflow"] = ERROR_WORKFLOW_ID
        modified = True

    if modified:
        out = json.dumps(data, indent=2, ensure_ascii=True)
        with open(path, "wb") as f:
            f.write(out.encode("ascii"))
        print(f"  PATCHED: {os.path.basename(path)}")
    else:
        print(f"  ALREADY SET: {os.path.basename(path)}")

    return modified


def main() -> int:
    print(f"Scanning: {WORKFLOWS_DIR}")
    if not os.path.isdir(WORKFLOWS_DIR):
        print(f"ERROR: Directory not found: {WORKFLOWS_DIR}")
        return 1

    files = sorted(
        f for f in os.listdir(WORKFLOWS_DIR)
        if f.endswith(".json")
    )

    if not files:
        print("No JSON files found.")
        return 1

    patched = 0
    skipped = 0
    for fname in files:
        fpath = os.path.join(WORKFLOWS_DIR, fname)
        was_patched = patch_file(fpath)
        if was_patched:
            patched += 1
        else:
            skipped += 1

    print(f"\nDone: {patched} patched, {skipped} skipped/already set.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
