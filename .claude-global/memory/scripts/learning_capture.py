#!/usr/bin/env python3
"""
learning_capture.py — Instinct capture for /learn and learning-capture Stop hook.

Manages instincts.jsonl: explicit patterns captured via /learn command
and auto-extracted patterns from session-end analysis.

Usage:
    python3 learning_capture.py --content "always use async context managers in FastAPI"
    python3 learning_capture.py --content "..." --scope ndtv1 --confidence 0.9
    python3 learning_capture.py --list
    python3 learning_capture.py --list --scope ndtv1
"""

import argparse
import json
import re
import sys
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from mem0_client import DATA_DIR, sanitize

INSTINCTS_FILE = DATA_DIR / 'instincts.jsonl'

# ---------------------------------------------------------------------------
# Core operations
# ---------------------------------------------------------------------------

def load_instincts(scope: str = None) -> list:
    if not INSTINCTS_FILE.exists():
        return []
    instincts = []
    with open(INSTINCTS_FILE) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
                if scope is None or item.get('scope') == scope or item.get('scope') == 'global':
                    instincts.append(item)
            except json.JSONDecodeError:
                pass
    return instincts

def save_instinct(pattern: str, scope: str = 'global', confidence: float = 0.8,
                  context_tags: list = None, source: str = 'manual') -> dict:
    """Append a new instinct to instincts.jsonl."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    pattern = sanitize(pattern.strip())
    now = datetime.now().strftime('%Y-%m-%d')

    # Check for near-duplicate
    existing = load_instincts()
    pattern_lower = pattern.lower()
    for inst in existing:
        existing_lower = inst.get('pattern', '').lower()
        # Simple overlap check
        words_new = set(re.findall(r'\w+', pattern_lower))
        words_existing = set(re.findall(r'\w+', existing_lower))
        if len(words_new) > 3:
            overlap = len(words_new & words_existing) / len(words_new | words_existing)
            if overlap > 0.7:
                print(f'Similar instinct already exists ({overlap:.0%} overlap):')
                print(f'  Existing: {inst["pattern"][:80]}')
                print(f'  New:      {pattern[:80]}')
                print('Skipping — use /evolve to merge if needed.')
                return inst

    instinct = {
        'id': f'inst_{uuid.uuid4().hex[:8]}',
        'pattern': pattern,
        'scope': scope,
        'confidence': confidence,
        'status': 'active',
        'context': context_tags or [],
        'source': source,
        'first_seen': now,
        'last_seen': now,
        'reinforcement_count': 1,
    }

    with open(INSTINCTS_FILE, 'a') as f:
        f.write(json.dumps(instinct) + '\n')

    return instinct

def list_instincts(scope: str = None, status: str = 'active', limit: int = 50) -> list:
    all_instincts = load_instincts(scope=None)
    filtered = [i for i in all_instincts
                if (status is None or i.get('status') == status)
                and (scope is None or i.get('scope') in (scope, 'global'))]
    return sorted(filtered, key=lambda x: x.get('confidence', 0), reverse=True)[:limit]

def get_stats() -> dict:
    all_instincts = load_instincts()
    by_scope = {}
    for inst in all_instincts:
        s = inst.get('scope', 'global')
        by_scope[s] = by_scope.get(s, 0) + 1
    active = sum(1 for i in all_instincts if i.get('status') == 'active')
    return {
        'total': len(all_instincts),
        'active': active,
        'deprecated': len(all_instincts) - active,
        'by_scope': by_scope,
        'avg_confidence': round(
            sum(i.get('confidence', 0) for i in all_instincts) / max(len(all_instincts), 1), 2
        )
    }

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='Manage learning instincts')
    parser.add_argument('--content', type=str, help='Pattern to learn')
    parser.add_argument('--scope', type=str, default='global',
                        help='Scope: global | ndtv1 | pi_lawyer_os | etc.')
    parser.add_argument('--confidence', type=float, default=0.8,
                        help='Confidence score 0.0-1.0 (default: 0.8)')
    parser.add_argument('--tags', type=str, help='Comma-separated context tags')
    parser.add_argument('--list', action='store_true', help='List instincts')
    parser.add_argument('--stats', action='store_true', help='Show statistics')
    parser.add_argument('--limit', type=int, default=20)
    args = parser.parse_args()

    if args.stats:
        stats = get_stats()
        print(json.dumps(stats, indent=2))
        return

    if args.list:
        instincts = list_instincts(scope=args.scope, limit=args.limit)
        if not instincts:
            print('No instincts found.')
            return
        print(f'\n{"ID":<14} {"Conf":>5}  {"Scope":<14} Pattern')
        print('-' * 80)
        for inst in instincts:
            conf = inst.get('confidence', 0)
            scope = inst.get('scope', 'global')
            pattern = inst.get('pattern', '')[:50]
            print(f'{inst["id"]:<14} {conf:>5.2f}  {scope:<14} {pattern}')
        print(f'\n{len(instincts)} instinct(s) shown.')
        return

    if args.content:
        tags = [t.strip() for t in args.tags.split(',')] if args.tags else []
        result = save_instinct(
            pattern=args.content,
            scope=args.scope,
            confidence=args.confidence,
            context_tags=tags,
        )
        print(f'Learned: [{result["id"]}] {result["pattern"][:70]}')
        print(f'  scope={result["scope"]} confidence={result["confidence"]}')
        return

    parser.print_help()

if __name__ == '__main__':
    main()
