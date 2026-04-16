"""
instincts.py — /learn and /evolve logic.
instincts.jsonl stores explicit learned patterns with confidence scores.
Separate from mem0 semantic memories — these are curated team standards.
"""

import argparse
import json
import sys
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from mem_client import INSTINCTS_FILE, MEMORY_USER_ID, is_online

# ── CRUD ──────────────────────────────────────────────────────────────────────

def load_instincts() -> list:
    if not INSTINCTS_FILE.exists():
        return []
    instincts = []
    with open(INSTINCTS_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    instincts.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return instincts

def save_instincts(instincts: list):
    INSTINCTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(INSTINCTS_FILE, "w") as f:
        for inst in instincts:
            f.write(json.dumps(inst) + "\n")

def next_id(instincts: list) -> str:
    if not instincts:
        return "inst_001"
    nums = []
    for inst in instincts:
        try:
            nums.append(int(inst["id"].split("_")[1]))
        except Exception:
            pass
    return f"inst_{(max(nums) + 1):03d}" if nums else "inst_001"

# ── /learn ────────────────────────────────────────────────────────────────────

def learn(pattern: str, scope: str = "global", context: list = None,
          confidence: float = 0.8) -> dict:
    """Add a new instinct pattern."""
    instincts = load_instincts()
    today = datetime.utcnow().strftime("%Y-%m-%d")

    # Check for near-duplicate (simple keyword overlap)
    for inst in instincts:
        if inst.get("status") != "active":
            continue
        existing = set(inst.get("pattern", "").lower().split())
        new_words = set(pattern.lower().split())
        overlap = len(existing & new_words) / max(len(existing | new_words), 1)
        if overlap > 0.7:
            # Update confidence and last_seen instead of duplicating
            inst["confidence"] = min(1.0, inst["confidence"] + 0.05)
            inst["last_seen"] = today
            save_instincts(instincts)
            return {"action": "updated_existing", "id": inst["id"],
                    "message": f"Similar instinct already exists: '{inst['pattern'][:60]}...' — confidence bumped to {inst['confidence']:.2f}"}

    new_inst = {
        "id": next_id(instincts),
        "pattern": pattern,
        "scope": scope,
        "context": context or [],
        "confidence": confidence,
        "status": "active",
        "first_seen": today,
        "last_seen": today,
        "source": "manual",
    }
    instincts.append(new_inst)
    save_instincts(instincts)
    return {"action": "created", "id": new_inst["id"], "pattern": pattern,
            "scope": scope, "confidence": confidence}

# ── /evolve ───────────────────────────────────────────────────────────────────

def evolve(dry_run: bool = False) -> dict:
    """
    Review instincts: merge near-duplicates, deprecate low-confidence,
    optionally use OpenRouter for semantic similarity if online.
    """
    instincts = load_instincts()
    active = [i for i in instincts if i.get("status") == "active"]

    if len(active) < 2:
        return {"status": "nothing_to_evolve", "active_count": len(active)}

    changes = []

    # ── Simple merge: keyword overlap > 80% ──────────────────────────────────
    merged_ids = set()
    for i, inst_a in enumerate(active):
        if inst_a["id"] in merged_ids:
            continue
        for inst_b in active[i + 1:]:
            if inst_b["id"] in merged_ids:
                continue
            words_a = set(inst_a["pattern"].lower().split())
            words_b = set(inst_b["pattern"].lower().split())
            overlap = len(words_a & words_b) / max(len(words_a | words_b), 1)
            if overlap > 0.8:
                # Keep higher-confidence, deprecate other
                keep = inst_a if inst_a["confidence"] >= inst_b["confidence"] else inst_b
                drop = inst_b if keep is inst_a else inst_a
                keep["confidence"] = min(1.0, keep["confidence"] + 0.05)
                keep["last_seen"] = datetime.utcnow().strftime("%Y-%m-%d")
                drop["status"] = "deprecated"
                drop["deprecated_reason"] = f"Merged into {keep['id']}"
                merged_ids.add(drop["id"])
                changes.append({"action": "merged", "kept": keep["id"],
                                 "deprecated": drop["id"], "overlap": round(overlap, 2)})

    # ── Deprecate stale low-confidence ───────────────────────────────────────
    from datetime import datetime as dt
    today = dt.utcnow()
    for inst in active:
        if inst["id"] in merged_ids:
            continue
        last = dt.strptime(inst.get("last_seen", "2020-01-01"), "%Y-%m-%d")
        age_days = (today - last).days
        if inst["confidence"] < 0.3 and age_days > 90:
            inst["status"] = "deprecated"
            inst["deprecated_reason"] = "Low confidence + stale (>90 days)"
            changes.append({"action": "deprecated_stale", "id": inst["id"],
                             "confidence": inst["confidence"], "age_days": age_days})

    # ── LLM-assisted merge (online only) ─────────────────────────────────────
    llm_merges = 0
    if is_online() and not dry_run:
        try:
            llm_merges = _llm_evolve(instincts, changes)
        except Exception:
            pass

    if not dry_run:
        save_instincts(instincts)

    return {
        "status": "dry_run" if dry_run else "evolved",
        "total_changes": len(changes),
        "llm_merges": llm_merges,
        "changes": changes,
    }

def _llm_evolve(instincts: list, changes: list) -> int:
    """Use OpenRouter to find semantic near-duplicates not caught by keyword overlap."""
    import urllib.request
    from mem_client import OPENROUTER_API_KEY, OPENROUTER_MODEL

    active = [i for i in instincts if i.get("status") == "active"]
    if len(active) < 3:
        return 0

    patterns = "\n".join(f"{i+1}. [{inst['id']}] {inst['pattern']}" for i, inst in enumerate(active))
    prompt = (f"Review these learned patterns and identify pairs that are semantically equivalent "
              f"(same meaning, different wording). Return a JSON array of pairs: "
              f"[[\"keep_id\", \"deprecate_id\"], ...]. Return [] if no duplicates.\n\n{patterns}")

    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps({
            "model": OPENROUTER_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 500, "temperature": 0.0,
        }).encode(),
        headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}",
                 "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        result = json.loads(r.read())

    text = result["choices"][0]["message"]["content"].strip()
    pairs = json.loads(re.search(r"\[.*\]", text, re.DOTALL).group()) if "[" in text else []

    import re
    by_id = {inst["id"]: inst for inst in instincts}
    count = 0
    for keep_id, drop_id in pairs:
        if keep_id in by_id and drop_id in by_id:
            if by_id[drop_id].get("status") == "active":
                by_id[drop_id]["status"] = "deprecated"
                by_id[drop_id]["deprecated_reason"] = f"LLM: semantic duplicate of {keep_id}"
                changes.append({"action": "llm_merged", "kept": keep_id, "deprecated": drop_id})
                count += 1
    return count


# ── List ──────────────────────────────────────────────────────────────────────

def list_instincts(scope: str = None, active_only: bool = True) -> list:
    instincts = load_instincts()
    if active_only:
        instincts = [i for i in instincts if i.get("status") == "active"]
    if scope:
        instincts = [i for i in instincts if i.get("scope") == scope]
    return sorted(instincts, key=lambda x: x.get("confidence", 0), reverse=True)

# ── Stats ─────────────────────────────────────────────────────────────────────

def stats() -> dict:
    instincts = load_instincts()
    active = [i for i in instincts if i.get("status") == "active"]
    deprecated = [i for i in instincts if i.get("status") == "deprecated"]
    by_scope = {}
    for inst in active:
        s = inst.get("scope", "global")
        by_scope[s] = by_scope.get(s, 0) + 1
    return {
        "total": len(instincts),
        "active": len(active),
        "deprecated": len(deprecated),
        "avg_confidence": round(sum(i.get("confidence",0) for i in active)/max(len(active),1), 2),
        "by_scope": by_scope,
    }

# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Instincts: /learn and /evolve")
    sub = parser.add_subparsers(dest="cmd")

    p_learn = sub.add_parser("learn")
    p_learn.add_argument("pattern",     type=str)
    p_learn.add_argument("--scope",     default="global")
    p_learn.add_argument("--context",   type=str, help="JSON array of tags")
    p_learn.add_argument("--confidence",type=float, default=0.8)

    p_evolve = sub.add_parser("evolve")
    p_evolve.add_argument("--dry-run",  action="store_true")

    sub.add_parser("list").add_argument("--scope", default=None)
    sub.add_parser("stats")

    args = parser.parse_args()

    if args.cmd == "learn":
        context = json.loads(args.context) if hasattr(args, "context") and args.context else []
        result = learn(args.pattern, scope=args.scope, context=context,
                       confidence=args.confidence)
    elif args.cmd == "evolve":
        result = evolve(dry_run=args.dry_run)
    elif args.cmd == "list":
        scope = getattr(args, "scope", None)
        result = list_instincts(scope=scope)
    elif args.cmd == "stats":
        result = stats()
    else:
        parser.print_help()
        return

    print(json.dumps(result, indent=2, default=str))

if __name__ == "__main__":
    main()
