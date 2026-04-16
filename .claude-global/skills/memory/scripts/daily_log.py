"""
daily_log.py — Append entries to today's daily session log.
Daily logs live in ~/.onnex-memory/logs/YYYY-MM-DD.md
"""

import argparse
import json
from datetime import datetime
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from mem_client import LOGS_DIR

ENTRY_TYPES = ["note", "event", "decision", "error", "insight", "task"]


def get_today_log() -> Path:
    return LOGS_DIR / f"{datetime.now().strftime('%Y-%m-%d')}.md"


def append_to_log(content: str, entry_type: str = "note") -> dict:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    log_path = get_today_log()

    if not log_path.exists():
        today = datetime.now()
        log_path.write_text(
            f"# Daily Log: {today.strftime('%Y-%m-%d')}\n\n"
            f"> {today.strftime('%A, %B %d, %Y')}\n\n---\n\n## Session Notes\n\n"
        )

    timestamp = datetime.now().strftime("%H:%M")
    prefix = f"[{entry_type}] " if entry_type != "note" else ""
    line = f"- {timestamp} {prefix}{content}\n"

    with open(log_path, "a") as f:
        f.write(line)

    return {"status": "logged", "path": str(log_path), "entry": line.strip()}


def main():
    parser = argparse.ArgumentParser(description="Daily session log")
    parser.add_argument("--content", required=True)
    parser.add_argument("--type", default="note", choices=ENTRY_TYPES)
    args = parser.parse_args()
    result = append_to_log(args.content, args.type)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
