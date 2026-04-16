"""
auto_capture.py — Stop hook for automatic memory extraction.
Reads new messages from Claude Code session transcript,
feeds to mem0 for fact extraction + FTS5 indexing.
Detects current project from working directory to set agent_id.
"""

import json
import logging
import re
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPTS_DIR))

from mem_client import (MARKERS_DIR, MEMORY_DIR, PENDING_DIR,
                         MEMORY_USER_ID, sanitize_text, is_online)

LOG_FILE = MEMORY_DIR / "auto_capture.log"
logging.basicConfig(
    filename=str(LOG_FILE), level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("auto_capture")

# ── Project detection ─────────────────────────────────────────────────────────

_PROJECT_MAP = {
    "ndt-portal-v1":  "ndtv1",
    "ndtv1":          "ndtv1",
    "pi-lawyer-os":   "pi_lawyer_os",
    "AI-OS-POC":      "ai_os_poc",
    "ai-sentinel":    "ai_sentinel",
    "agency-os":      "agency_os",
    "atomic-ai-bp":   "atomic_ai_bp",
    "email-triage":   "email_triage",
    "personal-to-do": "personal_to_do",
}

def detect_agent_id(cwd: str) -> str:
    """Map working directory to a mem0 agent_id scope."""
    if not cwd:
        return "global"
    for key, agent_id in _PROJECT_MAP.items():
        if key in cwd:
            return agent_id
    return "global"

# ── Transcript parsing ────────────────────────────────────────────────────────

def get_marker(session_id: str) -> int:
    MARKERS_DIR.mkdir(parents=True, exist_ok=True)
    marker_file = MARKERS_DIR / f"{session_id}.marker"
    try:
        return int(marker_file.read_text().strip()) if marker_file.exists() else 0
    except Exception:
        return 0

def set_marker(session_id: str, line_number: int):
    MARKERS_DIR.mkdir(parents=True, exist_ok=True)
    (MARKERS_DIR / f"{session_id}.marker").write_text(str(line_number))

def extract_text_from_content(content) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        texts = []
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "text":
                text = block.get("text", "").strip()
                if text.startswith("<system-reminder>") or text.startswith("<ide_"):
                    continue
                if len(text) < 10:
                    continue
                texts.append(text)
        return "\n".join(texts)
    return ""

def strip_system_tags(text: str) -> str:
    text = re.sub(r"<system-reminder>.*?</system-reminder>", "", text, flags=re.DOTALL)
    text = re.sub(r"<ide_\w+>.*?</ide_\w+>", "", text, flags=re.DOTALL)
    return text.strip()

def parse_new_messages(transcript_path: str, start_line: int):
    messages = []
    current_line = 0
    try:
        with open(transcript_path, "r") as f:
            for i, line in enumerate(f):
                current_line = i + 1
                if i < start_line:
                    continue
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if obj.get("type") not in ("user", "assistant"):
                    continue
                msg = obj.get("message", {})
                role = msg.get("role", "")
                text = extract_text_from_content(msg.get("content", ""))
                if not text:
                    continue
                text = strip_system_tags(text)
                if not text or len(text) < 15:
                    continue
                messages.append({"role": role, "content": text})
    except Exception as e:
        log.error(f"Failed to read transcript: {e}")
    return messages, current_line

def prepare_messages(messages, max_msg_chars=1500):
    cleaned = []
    for msg in messages:
        text = msg["content"]
        text = re.sub(r"```[\s\S]*?```", "[code block]", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        if len(text) > max_msg_chars:
            text = text[:max_msg_chars] + "..."
        if text and len(text) >= 15:
            cleaned.append({"role": msg["role"], "content": sanitize_text(text)})
    return cleaned

def batch_messages(messages, max_batch_chars=3000):
    batches, current_batch, current_size = [], [], 0
    for msg in messages:
        msg_len = len(msg["content"])
        if current_size + msg_len > max_batch_chars and current_batch:
            batches.append(current_batch)
            current_batch, current_size = [], 0
        current_batch.append(msg)
        current_size += msg_len
    if current_batch:
        batches.append(current_batch)
    return batches

# ── Extraction ────────────────────────────────────────────────────────────────

def feed_to_mem0(messages, agent_id: str):
    from mem_client import get_memory_client
    from smart_search import index_single_memory

    m = get_memory_client(agent_id)
    cleaned = prepare_messages(messages)
    batches = batch_messages(cleaned)
    total_events = 0

    for i, batch in enumerate(batches):
        try:
            result = m.add(batch, user_id=MEMORY_USER_ID,
                           metadata={"source": "auto_capture", "agent_id": agent_id})
            events = result.get("results", []) if isinstance(result, dict) else []
            total_events += len(events)
            for event in events:
                mid, text = event.get("id", ""), event.get("memory", "")
                if mid and text:
                    index_single_memory(mid, text, agent_id=agent_id)
            log.info(f"  Batch {i+1}/{len(batches)}: {len(events)} memory events")
        except Exception as e:
            log.error(f"  Batch {i+1} failed: {e}")

    return total_events

def queue_offline(messages, agent_id: str) -> int:
    """When offline: save raw messages to pending queue for later extraction."""
    import uuid
    from datetime import datetime
    PENDING_DIR.mkdir(parents=True, exist_ok=True)
    entry = {
        "id": str(uuid.uuid4()),
        "agent_id": agent_id,
        "messages": messages,
        "queued_at": datetime.utcnow().isoformat(),
        "source": "auto_capture",
    }
    with open(PENDING_DIR / "queue.jsonl", "a") as f:
        f.write(json.dumps(entry) + "\n")
    return 1

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    try:
        raw = sys.stdin.read()
        hook_input = json.loads(raw) if raw.strip() else {}
    except Exception:
        hook_input = {}

    session_id     = hook_input.get("session_id", "unknown")
    transcript_path = hook_input.get("transcript_path", "")
    cwd            = hook_input.get("cwd", "")
    agent_id       = detect_agent_id(cwd)

    log.info(f"Session {session_id} | agent={agent_id} | cwd={cwd}")

    if not transcript_path or not Path(transcript_path).exists():
        log.warning(f"No transcript at {transcript_path}")
        sys.exit(0)

    start_line = get_marker(session_id)
    messages, end_line = parse_new_messages(transcript_path, start_line)

    if not messages:
        log.info(f"No new messages since line {start_line}")
        set_marker(session_id, end_line)
        sys.exit(0)

    log.info(f"{len(messages)} new messages (lines {start_line}-{end_line})")

    try:
        if is_online():
            count = feed_to_mem0(messages, agent_id)
            log.info(f"Extracted {count} memory events (online)")
        else:
            count = queue_offline(messages, agent_id)
            log.info(f"Offline — queued {len(messages)} messages for later extraction")
    except Exception as e:
        log.error(f"Extraction failed: {e}")

    set_marker(session_id, end_line)
    sys.exit(0)


if __name__ == "__main__":
    main()
