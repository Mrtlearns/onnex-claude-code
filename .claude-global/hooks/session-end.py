#!/usr/bin/env python3
"""
session-end.py — Stop hook (SessionEnd)
Fires when a Claude Code session ends.
Based on PAI's SessionSummary pattern — Python port, no Bun required.

Actions:
  1. Marks current-work.json as COMPLETED (if exists)
  2. Writes a session log entry to .claude/state/sessions/
  3. Clears session state for clean next start
"""

import json
import sys
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


STATE_DIR = Path(".claude/state")
CURRENT_WORK_FILE = STATE_DIR / "current-work.json"
SESSIONS_DIR = STATE_DIR / "sessions"


def read_stdin_safe():
    """Read stdin JSON, return empty dict if nothing or parse fails."""
    try:
        raw = sys.stdin.read().strip()
        if not raw:
            return {}
        return json.loads(raw)
    except Exception:
        return {}


def mark_work_complete():
    """Mark current-work.json as completed and return its data."""
    if not CURRENT_WORK_FILE.exists():
        return None

    try:
        data = json.loads(CURRENT_WORK_FILE.read_text(encoding="utf-8"))
        data["status"] = "COMPLETED"
        data["completed_at"] = datetime.now().isoformat()
        # Write back with completed status before deleting
        CURRENT_WORK_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return data
    except Exception:
        return None


def write_session_log(hook_input, work_data):
    """Write a session log entry for historical reference."""
    try:
        SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

        now = datetime.now()
        session_id = hook_input.get("session_id", "unknown")
        filename = f"{now.strftime('%Y-%m-%d_%H-%M-%S')}_{session_id[:8]}.json"

        log_entry = {
            "session_id": session_id,
            "ended_at": now.isoformat(),
            "transcript_path": hook_input.get("transcript_path", ""),
        }

        if work_data:
            log_entry["work"] = {
                "project": work_data.get("project", ""),
                "notes": work_data.get("notes", ""),
                "next_steps": work_data.get("next_steps", []),
                "started_at": work_data.get("saved_at", ""),
            }

        (SESSIONS_DIR / filename).write_text(
            json.dumps(log_entry, indent=2), encoding="utf-8"
        )
    except Exception:
        pass  # Non-critical — don't disrupt session close


def clear_current_work():
    """Remove current-work.json to signal clean state for next session."""
    try:
        if CURRENT_WORK_FILE.exists():
            CURRENT_WORK_FILE.unlink()
    except Exception:
        pass


def main():
    hook_input = read_stdin_safe()
    work_data = mark_work_complete()
    write_session_log(hook_input, work_data)
    clear_current_work()

    if work_data:
        project = work_data.get("project", "session")
        print(f"Session ended \u2713  Work marked complete: {project}")
    else:
        print("Session ended \u2713")

    sys.exit(0)


if __name__ == "__main__":
    main()
