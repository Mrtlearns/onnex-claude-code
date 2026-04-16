#!/usr/bin/env python3
"""
auto_capture.py — Stop hook for automatic memory extraction.

Fires after every Claude Code session response cycle (Stop event).
Reads new transcript messages → sanitizes → feeds to mem0 for fact extraction.
Detects online/offline state — queues for later if offline.

Usage (hook command):
    wsl python3 /mnt/d/Code/Claude/.claude-global/memory/scripts/auto_capture.py

Input: JSON on stdin from Claude Code Stop hook:
    {"session_id": "...", "transcript_path": "...", "cwd": "..."}
"""

import json
import logging
import re
import sys
from pathlib import Path

# Add scripts dir to path
sys.path.insert(0, str(Path(__file__).parent))
from mem0_client import DATA_DIR, USER_ID, sanitize, is_online, get_memory_client

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOG_FILE = DATA_DIR / 'auto_capture.log'
DATA_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    filename=str(LOG_FILE),
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger('auto_capture')

# ---------------------------------------------------------------------------
# Marker files (track position in transcript per session)
# ---------------------------------------------------------------------------

MARKERS_DIR = DATA_DIR / 'capture_markers'
PENDING_DIR = DATA_DIR / 'pending_extraction'

def get_marker(session_id: str) -> int:
    f = MARKERS_DIR / f'{session_id}.marker'
    try:
        return int(f.read_text().strip()) if f.exists() else 0
    except (ValueError, IOError):
        return 0

def set_marker(session_id: str, line_number: int):
    MARKERS_DIR.mkdir(parents=True, exist_ok=True)
    (MARKERS_DIR / f'{session_id}.marker').write_text(str(line_number))

# ---------------------------------------------------------------------------
# Detect agent_id from cwd
# ---------------------------------------------------------------------------

def detect_agent_id(cwd: str) -> str:
    """Map the project directory to a mem0 agent_id."""
    if not cwd:
        return 'global'
    cwd_lower = cwd.lower().replace('\\', '/')
    project_map = {
        'ndt': 'ndtv1',
        'pi-lawyer': 'pi_lawyer_os',
        'pi_lawyer': 'pi_lawyer_os',
        'agency-os': 'agency_os',
        'atomic-ai': 'atomic_ai_bp',
        'email-triage': 'email_triage',
        'ai-os-poc': 'ai_os_poc',
        'ai-sentinel': 'ai_sentinel',
        'personal-to-do': 'personal_todo',
    }
    for key, agent_id in project_map.items():
        if key in cwd_lower:
            return agent_id
    return 'global'

# ---------------------------------------------------------------------------
# Transcript parsing
# ---------------------------------------------------------------------------

def extract_text(content):
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        texts = []
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get('type') == 'text':
                text = block.get('text', '').strip()
                if text.startswith('<system-reminder>') or text.startswith('<ide_'):
                    continue
                if len(text) >= 10:
                    texts.append(text)
        return '\n'.join(texts)
    return ''

def strip_system_tags(text: str) -> str:
    text = re.sub(r'<system-reminder>.*?</system-reminder>', '', text, flags=re.DOTALL)
    text = re.sub(r'<ide_\w+>.*?</ide_\w+>', '', text, flags=re.DOTALL)
    return text.strip()

def parse_new_messages(transcript_path: str, start_line: int):
    messages = []
    current_line = 0
    try:
        with open(transcript_path, 'r', errors='replace') as f:
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
                msg_type = obj.get('type')
                if msg_type not in ('user', 'assistant'):
                    continue
                msg = obj.get('message', {})
                role = msg.get('role', '')
                content = msg.get('content', '')
                text = extract_text(content)
                if not text:
                    continue
                text = strip_system_tags(sanitize(text))
                if text and len(text) >= 15:
                    messages.append({'role': role, 'content': text})
    except (IOError, OSError) as e:
        log.error(f'Failed to read transcript: {e}')
    return messages, current_line

def prepare_messages(messages, max_chars=1500):
    cleaned = []
    for msg in messages:
        text = msg['content']
        text = re.sub(r'```[\s\S]*?```', '[code block]', text)
        text = re.sub(r'\n{3,}', '\n\n', text).strip()
        if len(text) > max_chars:
            text = text[:max_chars] + '...'
        if text and len(text) >= 15:
            cleaned.append({'role': msg['role'], 'content': text})
    return cleaned

def batch_messages(messages, max_batch_chars=3000):
    batches, current_batch, current_size = [], [], 0
    for msg in messages:
        msg_len = len(msg['content'])
        if current_size + msg_len > max_batch_chars and current_batch:
            batches.append(current_batch)
            current_batch, current_size = [], 0
        current_batch.append(msg)
        current_size += msg_len
    if current_batch:
        batches.append(current_batch)
    return batches

# ---------------------------------------------------------------------------
# Offline queue
# ---------------------------------------------------------------------------

def queue_for_later(session_id: str, messages: list, agent_id: str):
    """Save messages to pending_extraction/ when offline."""
    PENDING_DIR.mkdir(parents=True, exist_ok=True)
    pending_file = PENDING_DIR / f'{session_id}.jsonl'
    with open(pending_file, 'a') as f:
        for msg in messages:
            f.write(json.dumps({'agent_id': agent_id, 'message': msg}) + '\n')
    log.info(f'Queued {len(messages)} messages for later extraction (offline)')

def drain_pending_queue():
    """Process queued messages when back online. Called at start if online."""
    if not PENDING_DIR.exists():
        return
    files = list(PENDING_DIR.glob('*.jsonl'))
    if not files:
        return
    log.info(f'Draining {len(files)} pending files...')
    for pending_file in files:
        try:
            by_agent = {}
            with open(pending_file) as f:
                for line in f:
                    item = json.loads(line.strip())
                    agent_id = item.get('agent_id', 'global')
                    by_agent.setdefault(agent_id, []).append(item['message'])
            for agent_id, msgs in by_agent.items():
                m = get_memory_client(agent_id)
                cleaned = prepare_messages(msgs)
                for batch in batch_messages(cleaned):
                    try:
                        m.add(batch, user_id=USER_ID, metadata={'source': 'auto_capture_recovered'})
                    except Exception as e:
                        log.error(f'Queue drain batch failed: {e}')
            pending_file.unlink()
            log.info(f'Drained: {pending_file.name}')
        except Exception as e:
            log.error(f'Queue drain failed for {pending_file.name}: {e}')

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Read hook input
    try:
        raw = sys.stdin.read()
        hook_input = json.loads(raw) if raw.strip() else None
    except Exception as e:
        log.error(f'Failed to read hook input: {e}')
        sys.exit(0)

    if not hook_input:
        sys.exit(0)

    session_id    = hook_input.get('session_id', 'unknown')
    transcript_path = hook_input.get('transcript_path', '')
    cwd           = hook_input.get('cwd', '')
    agent_id      = detect_agent_id(cwd)

    if not transcript_path or not Path(transcript_path).exists():
        log.warning(f'No transcript at {transcript_path}')
        sys.exit(0)

    log.info(f'Session {session_id} | project: {agent_id}')

    # Parse new messages
    start_line = get_marker(session_id)
    messages, end_line = parse_new_messages(transcript_path, start_line)
    set_marker(session_id, end_line)

    if not messages:
        log.info(f'No new messages since line {start_line}')
        sys.exit(0)

    log.info(f'{len(messages)} new messages (lines {start_line}→{end_line})')

    # Check connectivity
    online = is_online()
    if not online:
        queue_for_later(session_id, messages, agent_id)
        sys.exit(0)

    # Drain any pending queue first
    try:
        drain_pending_queue()
    except Exception as e:
        log.error(f'Queue drain error: {e}')

    # Extract memories
    try:
        m = get_memory_client(agent_id)
        cleaned = prepare_messages(messages)
        batches = batch_messages(cleaned)
        total_events = 0
        for i, batch in enumerate(batches):
            try:
                result = m.add(batch, user_id=USER_ID, metadata={'source': 'auto_capture', 'agent_id': agent_id})
                events = result.get('results', []) if isinstance(result, dict) else []
                total_events += len(events)
                log.info(f'  Batch {i+1}/{len(batches)}: {len(events)} events')
            except Exception as e:
                log.error(f'  Batch {i+1} failed: {e}')
        log.info(f'Done — {total_events} memory events for agent={agent_id}')
    except Exception as e:
        log.error(f'Extraction failed: {e}')

    sys.exit(0)

if __name__ == '__main__':
    main()
