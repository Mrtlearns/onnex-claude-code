#!/usr/bin/env python3
"""
smart_search.py — Hybrid memory search: vector + BM25 + temporal decay + MMR diversity.

Usage:
    python3 smart_search.py --query "topic" --limit 5
    python3 smart_search.py --query "topic" --agent-id ndtv1
    python3 smart_search.py --rebuild-index
"""

import argparse
import json
import math
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from mem0_client import DATA_DIR, USER_ID, get_memory_client

HISTORY_DB  = DATA_DIR / 'mem0_history.db'
FTS_TABLE   = 'memory_fts'
HALF_LIFE_DAYS = 45
MMR_LAMBDA  = 0.7
VECTOR_W    = 0.65
TEXT_W      = 0.35

# ---------------------------------------------------------------------------
# FTS5 index
# ---------------------------------------------------------------------------

def _conn():
    conn = sqlite3.connect(str(HISTORY_DB))
    conn.row_factory = sqlite3.Row
    return conn

def ensure_fts(conn):
    conn.execute(f'CREATE VIRTUAL TABLE IF NOT EXISTS {FTS_TABLE} USING fts5(memory_id, memory, agent_id UNINDEXED)')
    conn.commit()

def rebuild_fts_index():
    if not HISTORY_DB.exists():
        return {'status': 'skipped', 'reason': 'no history DB yet'}
    conn = _conn()
    ensure_fts(conn)
    conn.execute(f'DELETE FROM {FTS_TABLE}')
    try:
        rows = conn.execute('''
            SELECT h.memory_id, h.new_memory AS memory
            FROM history h
            INNER JOIN (
                SELECT memory_id, MAX(rowid) AS max_rowid
                FROM history WHERE is_deleted = 0 GROUP BY memory_id
            ) latest ON h.memory_id = latest.memory_id AND h.rowid = latest.max_rowid
            WHERE h.event != 'DELETE' AND h.new_memory IS NOT NULL
        ''').fetchall()
    except Exception:
        conn.close()
        return {'status': 'skipped', 'reason': 'history table not ready'}
    for row in rows:
        conn.execute(f'INSERT INTO {FTS_TABLE}(memory_id, memory, agent_id) VALUES (?,?,?)',
                     (row['memory_id'], row['memory'], 'global'))
    conn.commit()
    count = len(rows)
    conn.close()
    return {'status': 'rebuilt', 'indexed': count}

def index_memory(memory_id: str, memory_text: str, agent_id: str = 'global'):
    conn = _conn()
    ensure_fts(conn)
    conn.execute(f'DELETE FROM {FTS_TABLE} WHERE memory_id = ?', (memory_id,))
    conn.execute(f'INSERT INTO {FTS_TABLE}(memory_id, memory, agent_id) VALUES (?,?,?)',
                 (memory_id, memory_text, agent_id))
    conn.commit()
    conn.close()

def bm25_search(query: str, agent_id: str = None, limit: int = 20) -> list:
    if not HISTORY_DB.exists():
        return []
    conn = _conn()
    ensure_fts(conn)
    sql = f'SELECT memory_id, memory, bm25({FTS_TABLE}) AS score FROM {FTS_TABLE} WHERE {FTS_TABLE} MATCH ? ORDER BY score LIMIT ?'
    try:
        rows = conn.execute(sql, (query, limit)).fetchall()
    except Exception:
        try:
            escaped = '"' + query.replace('"', '""') + '"'
            rows = conn.execute(sql, (escaped, limit)).fetchall()
        except Exception:
            conn.close()
            return []
    conn.close()
    return [{'memory_id': r['memory_id'], 'memory': r['memory'], 'bm25_score': -r['score']} for r in rows]

# ---------------------------------------------------------------------------
# Temporal decay & MMR
# ---------------------------------------------------------------------------

def apply_decay(results: list, half_life: float = HALF_LIFE_DAYS) -> list:
    lam = math.log(2) / half_life
    now = datetime.now(timezone.utc)
    for item in results:
        ts_str = item.get('updated_at') or item.get('created_at') or ''
        try:
            ts = datetime.fromisoformat(str(ts_str))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            age = (now - ts).total_seconds() / 86400
        except Exception:
            age = 0
        base = item.get('score', item.get('fused_score', 0.5))
        item['age_days'] = round(age, 1)
        item['decayed_score'] = base * math.exp(-lam * age)
    return results

def _tokens(text: str) -> set:
    return set(re.findall(r'\w+', text.lower()))

def _jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if (a or b) else 0.0

def apply_mmr(results: list, limit: int, lam: float = MMR_LAMBDA) -> list:
    if not results or limit <= 0:
        return results[:limit]
    for item in results:
        item['_tokens'] = _tokens(item.get('memory', ''))
    candidates = sorted(results, key=lambda x: x.get('decayed_score', 0), reverse=True)
    selected = [candidates.pop(0)]
    while len(selected) < limit and candidates:
        best, best_idx = -float('inf'), 0
        for i, cand in enumerate(candidates):
            rel = cand.get('decayed_score', 0)
            max_sim = max(_jaccard(cand['_tokens'], s['_tokens']) for s in selected)
            mmr = lam * rel - (1 - lam) * max_sim
            if mmr > best:
                best, best_idx = mmr, i
        selected.append(candidates.pop(best_idx))
    for item in selected:
        item.pop('_tokens', None)
    return selected

# ---------------------------------------------------------------------------
# Main search
# ---------------------------------------------------------------------------

def smart_search(query: str, agent_id: str = 'global', limit: int = 10,
                 vector_weight: float = VECTOR_W, text_weight: float = TEXT_W,
                 half_life: float = HALF_LIFE_DAYS, mmr_lambda: float = MMR_LAMBDA) -> dict:
    fetch = max(limit * 3, 15)

    # Vector search
    m = get_memory_client(agent_id)
    raw = m.search(query, user_id=USER_ID, agent_id=agent_id, limit=fetch)
    raw_results = raw.get('results', raw) if isinstance(raw, dict) else raw

    items = []
    for r in raw_results:
        items.append({
            'id': r.get('id', ''),
            'memory': r.get('memory', ''),
            'vector_score': r.get('score', 0),
            'created_at': r.get('created_at', ''),
            'updated_at': r.get('updated_at', ''),
        })

    # BM25 search
    bm25_results = bm25_search(query, agent_id=agent_id, limit=fetch)
    bm25_lookup = {r['memory_id']: r['bm25_score'] for r in bm25_results}

    # Add BM25-only hits
    vec_ids = {item['id'] for item in items}
    for br in bm25_results:
        if br['memory_id'] not in vec_ids:
            items.append({'id': br['memory_id'], 'memory': br['memory'],
                         'vector_score': 0, 'created_at': '', 'updated_at': ''})

    if not items:
        return {'results': []}

    # Normalize vector scores
    scores = [item['vector_score'] for item in items]
    lo, hi = min(scores), max(scores)
    spread = hi - lo if hi > lo else 1.0
    for item in items:
        item['vector_score'] = (item['vector_score'] - lo) / spread

    # Normalize BM25
    max_bm25 = max(bm25_lookup.values()) if bm25_lookup else 1.0
    for item in items:
        raw_bm25 = bm25_lookup.get(item['id'], 0)
        item['bm25_score'] = raw_bm25 / max_bm25 if max_bm25 > 0 else 0
        item['fused_score'] = vector_weight * item['vector_score'] + text_weight * item['bm25_score']
        item['score'] = item['fused_score']

    # Temporal decay + MMR
    apply_decay(items, half_life)
    for item in items:
        item['score'] = item['decayed_score']

    final = apply_mmr(items, limit, mmr_lambda)
    return {'results': [{
        'id': item['id'],
        'memory': item['memory'],
        'score': round(item.get('decayed_score', item.get('score', 0)), 4),
        'created_at': item.get('created_at', ''),
        'debug': {
            'vector': round(item.get('vector_score', 0), 4),
            'bm25':   round(item.get('bm25_score', 0), 4),
            'fused':  round(item.get('fused_score', 0), 4),
            'age_d':  item.get('age_days', 0),
        }
    } for item in final]}

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='Smart hybrid memory search')
    parser.add_argument('--query', type=str)
    parser.add_argument('--agent-id', type=str, default='global')
    parser.add_argument('--limit', type=int, default=10)
    parser.add_argument('--rebuild-index', action='store_true')
    args = parser.parse_args()

    if args.rebuild_index:
        print(json.dumps(rebuild_fts_index(), indent=2))
        return

    if not args.query:
        parser.error('--query required')

    results = smart_search(args.query, agent_id=args.agent_id, limit=args.limit)
    print(json.dumps(results, indent=2, default=str))

if __name__ == '__main__':
    main()
