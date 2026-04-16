#!/usr/bin/env python3
"""
cost-tracker.py — PostToolUse hook
Tracks tool invocations per session to surface usage patterns and flag heavy agent work.
Logs to .claude/state/cost-log.json — view with: cat .claude/state/cost-log.json
"""

import json
import sys
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

# Relative cost weights per tool type (Agent = most expensive, Read = free)
TOOL_WEIGHT = {
    "Agent":      10,  # Spawns full subagent session
    "Task":       10,
    "WebSearch":   3,
    "WebFetch":    2,
    "Bash":        1,
    "Write":       1,
    "Edit":        1,
    "MultiEdit":   1,
    "Read":        0,
    "Glob":        0,
    "Grep":        0,
}

ALERT_THRESHOLD = 50   # Warn every N weight units

try:
    input_data = json.loads(sys.stdin.read())
except Exception:
    sys.exit(0)

tool_name = input_data.get("tool_name", "Unknown")
weight = TOOL_WEIGHT.get(tool_name, 1)

state_dir = Path(".claude/state")
state_dir.mkdir(parents=True, exist_ok=True)
log_file = state_dir / "cost-log.json"

# Load or initialize log
try:
    log = json.loads(log_file.read_text(encoding="utf-8")) if log_file.exists() else {"sessions": []}
except Exception:
    log = {"sessions": []}

today = datetime.now().strftime("%Y-%m-%d")

# Find or create today's entry
session = next((s for s in log["sessions"] if s.get("date") == today), None)
if session is None:
    session = {"date": today, "tools": {}, "total_calls": 0, "weight_total": 0}
    log["sessions"].append(session)

prev_weight = session.get("weight_total", 0)
session["tools"][tool_name] = session["tools"].get(tool_name, 0) + 1
session["total_calls"] = session.get("total_calls", 0) + 1
session["weight_total"] = prev_weight + weight

# Alert on crossing thresholds
new_weight = session["weight_total"]
if ALERT_THRESHOLD > 0 and (prev_weight // ALERT_THRESHOLD) < (new_weight // ALERT_THRESHOLD):
    agent_calls = session["tools"].get("Agent", 0) + session["tools"].get("Task", 0)
    print(
        f"[COST TRACKER] Session weight: {new_weight} units | "
        f"{session['total_calls']} calls | {agent_calls} agent invocations",
        file=sys.stderr,
    )

try:
    log_file.write_text(json.dumps(log, indent=2), encoding="utf-8")
except Exception:
    pass  # Never block execution over logging failure

sys.exit(0)
