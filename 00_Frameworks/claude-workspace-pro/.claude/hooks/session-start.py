#!/usr/bin/env python3
"""
session-start.py — SessionStart hook
Fires when a Claude Code session opens.
Injects workspace state + TELOS context summary into Claude's context.
"""

import subprocess
import sys
import json
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


# ─────────────────────────────────────────────
# GIT
# ─────────────────────────────────────────────

def get_git_status():
    try:
        status = subprocess.check_output(
            ["git", "status", "--short"], stderr=subprocess.DEVNULL
        ).decode().strip()
        log = subprocess.check_output(
            ["git", "log", "--oneline", "-5"], stderr=subprocess.DEVNULL
        ).decode().strip()
        branch = subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"], stderr=subprocess.DEVNULL
        ).decode().strip()
        return (
            f"Branch: {branch}\n"
            f"Status: {status or '(clean)'}\n\n"
            f"Last 5 commits:\n{log}"
        )
    except Exception:
        return "(not a git repository)"


# ─────────────────────────────────────────────
# WORKSPACE STATE
# ─────────────────────────────────────────────

def get_pending_plans():
    plans_dir = Path("plans")
    if not plans_dir.exists():
        return "(no plans/ directory)"
    plans = sorted(plans_dir.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not plans:
        return "(no plans yet)"
    return "\n".join(f"  - {p.name}" for p in plans[:5])


def get_recent_outputs():
    outputs_dir = Path("outputs")
    if not outputs_dir.exists():
        return "(no outputs/ directory)"
    files = [f for f in outputs_dir.rglob("*") if f.is_file()]
    if not files:
        return "(no outputs yet)"
    files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
    return "\n".join(f"  - {f.name}" for f in files[:5])


def get_current_data():
    path = Path("context/current-data.md")
    if not path.exists():
        return "(context/current-data.md not found)"
    lines = path.read_text(encoding="utf-8").splitlines()
    return "\n".join(lines[:30])


# ─────────────────────────────────────────────
# TELOS SUMMARY
# ─────────────────────────────────────────────

def read_telos_summary():
    """Extract a compact summary from TELOS files for context injection."""
    summaries = []

    def extract_section(file_path, heading_marker, max_lines=15):
        """Read first N lines of a TELOS file, skipping header boilerplate."""
        p = Path(file_path)
        if not p.exists():
            return None
        lines = p.read_text(encoding="utf-8").splitlines()
        # Skip frontmatter / description block (lines before first ##)
        content_lines = []
        in_content = False
        for line in lines:
            if line.startswith("## ") or line.startswith("### "):
                in_content = True
            if in_content:
                content_lines.append(line)
            if len(content_lines) >= max_lines:
                break
        return "\n".join(content_lines) if content_lines else None

    # MISSION — top 10 lines of content
    m = extract_section("context/TELOS/MISSION.md", "##", 10)
    if m:
        summaries.append(f"**MISSION:**\n{m}")

    # GOALS — active goals section
    g = extract_section("context/TELOS/GOALS.md", "##", 20)
    if g:
        summaries.append(f"**GOALS:**\n{g}")

    # CHALLENGES — current obstacles
    c = extract_section("context/TELOS/CHALLENGES.md", "##", 15)
    if c:
        summaries.append(f"**CHALLENGES:**\n{c}")

    # PROJECTS — active projects
    p = extract_section("context/TELOS/PROJECTS.md", "##", 20)
    if p:
        summaries.append(f"**ACTIVE PROJECTS:**\n{p}")

    if not summaries:
        return "(TELOS files not yet populated — run /prime and fill in context/TELOS/)"

    return "\n\n".join(summaries)


# ─────────────────────────────────────────────
# MEMORY STATE (PAI-inspired)
# ─────────────────────────────────────────────

def get_active_work():
    """Check for any saved session state from previous runs."""
    state_file = Path(".claude/state/current-work.json")
    if not state_file.exists():
        return None
    try:
        data = json.loads(state_file.read_text(encoding="utf-8"))
        project = data.get("project", "Unknown")
        notes = data.get("notes", "")
        next_steps = data.get("next_steps", [])
        saved_at = data.get("saved_at", "")

        lines = [f"📋 ACTIVE WORK (from previous session — {saved_at}):"]
        lines.append(f"  Project: {project}")
        if notes:
            lines.append(f"  Notes: {notes}")
        if next_steps:
            lines.append("  Next steps:")
            for step in next_steps[:5]:
                lines.append(f"    → {step}")
        return "\n".join(lines)
    except Exception:
        return None


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

now = datetime.now().strftime("%Y-%m-%d %H:%M")
active_work = get_active_work()

context_parts = [
    f"=== SESSION START: {now} ===",
    "",
    "--- GIT ---",
    get_git_status(),
    "",
    "--- PENDING PLANS ---",
    get_pending_plans(),
    "",
    "--- RECENT OUTPUTS ---",
    get_recent_outputs(),
    "",
    "--- CURRENT DATA (context/current-data.md) ---",
    get_current_data(),
    "",
    "--- TELOS CONTEXT SUMMARY ---",
    read_telos_summary(),
]

if active_work:
    context_parts += ["", active_work]

context_parts.append("")
context_parts.append("=== END SESSION CONTEXT ===")

print("\n".join(context_parts))
