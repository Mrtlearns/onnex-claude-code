"""
mem_add.py — Add memories to the semantic store.
Sanitizes secrets, sends to mem0 (OpenRouter extraction), indexes in FTS5.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from mem_client import get_memory_client, MEMORY_USER_ID, sanitize_text, is_online, PENDING_DIR
from smart_search import index_single_memory


def add_memory(content=None, messages=None, metadata=None,
               agent_id: str = "global") -> dict:
    """
    Add a memory. Sanitizes first, then calls mem0 (which calls OpenRouter for extraction).
    If offline, queues to pending/ for later processing.
    """
    if not is_online():
        # Queue for later — still save raw content offline
        return _queue_offline(content=content, messages=messages,
                               metadata=metadata, agent_id=agent_id)

    m = get_memory_client(agent_id)
    kwargs = {"user_id": MEMORY_USER_ID}
    if metadata:
        kwargs["metadata"] = {**(metadata or {}), "agent_id": agent_id}
    else:
        kwargs["metadata"] = {"agent_id": agent_id}

    if messages:
        messages = [{"role": msg["role"], "content": sanitize_text(msg["content"])}
                    for msg in messages]
        result = m.add(messages, **kwargs)
    elif content:
        result = m.add(sanitize_text(content), **kwargs)
    else:
        return {"error": "Provide --content or --messages"}

    # Index new/updated in FTS5
    try:
        events = result.get("results", []) if isinstance(result, dict) else []
        for event in events:
            mid  = event.get("id", "")
            text = event.get("memory", "")
            if mid and text:
                index_single_memory(mid, text, agent_id=agent_id)
    except Exception:
        pass

    return result


def _queue_offline(content=None, messages=None, metadata=None, agent_id="global") -> dict:
    """Save to pending queue when offline. Processed later by sync_pending.py."""
    import uuid
    from datetime import datetime
    PENDING_DIR.mkdir(parents=True, exist_ok=True)
    entry = {
        "id": str(uuid.uuid4()),
        "agent_id": agent_id,
        "content": content,
        "messages": messages,
        "metadata": metadata,
        "queued_at": datetime.utcnow().isoformat(),
        "source": "offline_queue",
    }
    with open(PENDING_DIR / "queue.jsonl", "a") as f:
        f.write(json.dumps(entry) + "\n")
    return {"status": "queued_offline", "id": entry["id"]}


def main():
    parser = argparse.ArgumentParser(description="Add memory via mem0")
    parser.add_argument("--content",  type=str)
    parser.add_argument("--messages", type=str, help="JSON array [{role, content}]")
    parser.add_argument("--metadata", type=str, help="JSON dict")
    parser.add_argument("--agent-id", default="global")
    args = parser.parse_args()

    messages = json.loads(args.messages) if args.messages else None
    metadata = json.loads(args.metadata) if args.metadata else None

    result = add_memory(content=args.content, messages=messages,
                        metadata=metadata, agent_id=args.agent_id)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
