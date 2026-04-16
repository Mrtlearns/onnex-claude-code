"""
mem_sync_md.py — Sync mem0 memories to ~/.onnex-memory/../MEMORY.md
Classifies memories into sections using OpenRouter, writes human-readable markdown.
Run manually or via cron after heavy sessions.
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from mem_client import get_memory_client, MEMORY_USER_ID, GLOBAL_MEMORY_MD, is_online

SECTIONS = [
    "User Preferences",
    "Key Facts",
    "Learned Behaviors",
    "Active Projects",
    "Technical Context",
    "Relationships & Contacts",
]


def classify_memories(memories: list) -> dict:
    """Use OpenRouter to classify memories into sections."""
    if not is_online():
        # Unclassified dump when offline
        return {"Key Facts": [m.get("memory", "") for m in memories if m.get("memory")]}

    import urllib.request
    from mem_client import OPENROUTER_API_KEY, OPENROUTER_MODEL

    classified = {s: [] for s in SECTIONS}
    texts = [m.get("memory", "") for m in memories if m.get("memory")]
    if not texts:
        return classified

    chunk_size = 25
    for i in range(0, len(texts), chunk_size):
        chunk = texts[i:i + chunk_size]
        numbered = "\n".join(f"{j+1}. {t}" for j, t in enumerate(chunk))
        prompt = (
            f"Classify each numbered memory into exactly one of these sections:\n"
            f"{json.dumps(SECTIONS)}\n\n"
            f"Return JSON: {{\"classifications\": [{{\"index\": 1, \"section\": \"Key Facts\"}}, ...]}}\n\n"
            f"Rules:\n"
            f"- Preferences/style/tools → 'User Preferences'\n"
            f"- Company/project/goal facts → 'Key Facts'\n"
            f"- Patterns/mistakes/fixes → 'Learned Behaviors'\n"
            f"- Active work/tasks → 'Active Projects'\n"
            f"- Stack/APIs/architecture → 'Technical Context'\n"
            f"- People/clients/contacts → 'Relationships & Contacts'\n\n"
            f"{numbered}"
        )

        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=json.dumps({
                "model": OPENROUTER_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 800, "temperature": 0.0,
            }).encode(),
            headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}",
                     "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                result = json.loads(r.read())
            text = result["choices"][0]["message"]["content"].strip()
            data = json.loads(text)
            for item in data.get("classifications", []):
                idx = item.get("index", 0) - 1
                section = item.get("section", "Key Facts")
                if 0 <= idx < len(chunk) and section in SECTIONS:
                    classified[section].append(chunk[idx])
        except Exception:
            for t in chunk:
                classified["Key Facts"].append(t)

    return classified


def render_memory_md(classified: dict, agent_id: str = "global") -> str:
    today = datetime.utcnow().strftime("%Y-%m-%d")
    scope_label = f" [{agent_id}]" if agent_id != "global" else ""

    lines = [
        f"# Persistent Memory{scope_label}",
        "",
        "> Auto-synced from mem0 semantic store.",
        "> Regenerate: `mem_sync_md.py --agent-id <scope>`",
        "",
    ]

    for section in SECTIONS:
        items = classified.get(section, [])
        lines.append(f"## {section}")
        lines.append("")
        if items:
            for item in items:
                clean = item.strip().replace("\n", " ")
                lines.append(f"- {clean}" if not clean.startswith("- ") else clean)
        else:
            lines.append("- (none)")
        lines.append("")

    lines.extend(["---", f"*Last synced: {today}*", ""])
    return "\n".join(lines)


def sync(agent_id: str = "global", dry_run: bool = False) -> dict:
    m = get_memory_client(agent_id)
    try:
        all_mems = m.get_all(user_id=MEMORY_USER_ID)
        memories = all_mems.get("results", []) if isinstance(all_mems, dict) else (all_mems or [])
    except Exception:
        memories = []

    print(f"Found {len(memories)} memories for agent={agent_id}")
    classified = classify_memories(memories)
    content = render_memory_md(classified, agent_id)

    if dry_run:
        print("--- DRY RUN ---")
        print(content)
        return {"status": "dry_run", "total": len(memories)}

    # Write to global MEMORY.md (read by Claude Code session-start)
    GLOBAL_MEMORY_MD.parent.mkdir(parents=True, exist_ok=True)
    GLOBAL_MEMORY_MD.write_text(content)
    print(f"Written to {GLOBAL_MEMORY_MD}")
    return {"status": "synced", "total": len(memories), "path": str(GLOBAL_MEMORY_MD)}


def main():
    parser = argparse.ArgumentParser(description="Sync mem0 to MEMORY.md")
    parser.add_argument("--agent-id", default="global")
    parser.add_argument("--dry-run",  action="store_true")
    args = parser.parse_args()
    result = sync(agent_id=args.agent_id, dry_run=args.dry_run)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
