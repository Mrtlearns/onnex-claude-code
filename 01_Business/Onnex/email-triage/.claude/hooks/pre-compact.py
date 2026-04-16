#!/usr/bin/env python3
"""
pre-compact.py — PreCompact hook
Fires before Claude Code compacts the conversation context.

DEFAULT (CLAUDE_AGGRESSIVE_COMPACT unset): saves a recovery snapshot, exits.
AGGRESSIVE (CLAUDE_AGGRESSIVE_COMPACT=1): reads recent transcript messages,
  detects the active task domain, outputs a topic-aware customSystemPrompt
  that tells Claude to preserve relevant context and compress unrelated context.
  Saves a compact-manifest.json so session-start can warn on re-injection.

UNDO: unset CLAUDE_AGGRESSIVE_COMPACT (or set to 0) to revert to default.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

now = datetime.now()
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
state_dir = PROJECT_ROOT / ".claude" / "state"
state_dir.mkdir(parents=True, exist_ok=True)

# ── Always: save recovery snapshot ────────────────────────────────────────────

current_work_file = state_dir / "current-work.json"
snapshot = {"compacted_at": now.isoformat(), "work": None}
if current_work_file.exists():
    try:
        snapshot["work"] = json.loads(current_work_file.read_text(encoding="utf-8"))
    except Exception:
        pass

(state_dir / "pre-compact-snapshot.json").write_text(
    json.dumps(snapshot, indent=2), encoding="utf-8"
)

# ── Kill switch: default = original behaviour ──────────────────────────────────

if os.environ.get("CLAUDE_AGGRESSIVE_COMPACT", "0") != "1":
    work_label = ""
    if snapshot["work"]:
        project = snapshot["work"].get("project", "")
        if project:
            work_label = f" | Active: {project}"
    print(
        f"[PRE-COMPACT] Snapshot saved at {now.strftime('%H:%M:%S')}"
        f"{work_label} — work state preserved."
    )
    sys.exit(0)

# ── Aggressive mode ────────────────────────────────────────────────────────────

# Read hook input (transcript path comes via stdin JSON)
transcript_path = ""
try:
    hook_input = json.load(sys.stdin)
    transcript_path = hook_input.get("transcript_path", "")
except Exception:
    pass

# Extract last 10 human messages from transcript
recent_messages = []
if transcript_path and Path(transcript_path).exists():
    try:
        with open(transcript_path, "r", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                try:
                    msg = json.loads(line.strip())
                    if msg.get("type") in ("human", "user"):
                        content = msg.get("content", "")
                        if isinstance(content, list):
                            content = " ".join(
                                c.get("text", "")
                                for c in content
                                if isinstance(c, dict)
                            )
                        if content.strip():
                            recent_messages.append(content)
                except Exception:
                    pass
        recent_messages = recent_messages[-10:]
    except Exception:
        pass

# Detect active domain from recent messages
TOPIC_KEYWORDS = {
    "NDT/Aerospace":    ["ndt", "rt analysis", "itar", "radiographic", "inspection", "ndt-portal", "two-stage", "ndtv1"],
    "PI Law":           ["pi law", "personal injury", "tcpa", "pi-lawyer", "litify", "filevine", "pi firm", "intake form"],
    "Docker/Infra":     ["docker", "proxmox", "traefik", "docker compose", "container", "lxc", "ansible", "proxmox"],
    "n8n/Automation":   ["n8n", " workflow", "automation", "n8n node", "trigger node"],
    "Agency-OS/GSD":    ["ai-os", "agency-os", "gsd", "fastify", "ai-os-poc", "agency os"],
    "RAG/AI":           ["rag", "embedding", "pgvector", "retrieval", "vector search", "anthropic sdk", "ollama"],
    "Security":         ["ai-sentinel", "sentinel", "oidc", "authentik", "policy rule"],
    "Hooks/Tooling":    ["pre-compact", "session-start", "statusline", "settings.json", "claude hook"],
}

combined = " ".join(recent_messages).lower()
active_topics   = [t for t, kws in TOPIC_KEYWORDS.items() if any(kw in combined for kw in kws)]
inactive_topics = [t for t in TOPIC_KEYWORDS if t not in active_topics]

active_label   = ", ".join(active_topics)   if active_topics   else "general"
compress_label = ", ".join(inactive_topics) if inactive_topics else "none detected"

# Save manifest for session-start recovery warning
manifest = {
    "compacted_at": now.isoformat(),
    "mode": "aggressive",
    "active_topics": active_topics,
    "compressed_topics": inactive_topics,
}
(state_dir / "compact-manifest.json").write_text(
    json.dumps(manifest, indent=2), encoding="utf-8"
)

# Build topic-aware compaction prompt
custom_prompt = f"""Compact this conversation history into a dense, actionable summary that preserves everything needed to continue active work without interruption.

DETECTED ACTIVE FOCUS: {active_label}

PRESERVE IN FULL:
- All code written, file paths modified, and exact commands run this session
- Current state of in-progress work: what is done, what is not, what broke
- Every decision and its rationale (conclusion only — drop the debate)
- Error messages verbatim — they are needed for debugging
- TELOS context, project goals, and constraints relevant to: {active_label}

COMPRESS AGGRESSIVELY:
- TELOS sections, vertical intel, and project context for unrelated domains: {compress_label}
- Exploratory discussion where a decision was reached (keep outcome, drop exploration)
- Repeated or redundant tool outputs (keep first + final state only)
- File contents that are unchanged from disk (reference path, don't repeat content)

SAFETY RULE: When uncertain whether content is relevant to continuing the active task, KEEP IT. The goal is to strip noise about unrelated domains — not to remove working context.

End your compacted summary with this exact block (required — do not omit):
[COMPACT-MANIFEST]
active: {active_label}
compressed: {compress_label}
[/COMPACT-MANIFEST]"""

print(json.dumps({"customSystemPrompt": custom_prompt}))
