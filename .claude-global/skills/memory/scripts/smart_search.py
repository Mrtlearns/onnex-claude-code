"""
smart_search.py — Hybrid memory search
Combines mem0 vector search + SQLite FTS5 keyword search.
Applies temporal decay (recent memories rank higher) and MMR diversity.
Works offline for keyword search; vector search needs embeddings (CPU, always available).
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
from mem_client import FTS_DB_PATH, MEMORY_USER_ID

# ── Defaults ─────────────────────────────────────────────────────────────────

DEFAULT_HALF_LIFE_DAYS = 45
DEFAULT_MMR_LAMBDA     = 0.7
DEFAULT_VECTOR_WEIGHT  = 0.65
DEFAULT_TEXT_WEIGHT    = 0.35
FTS_TABLE              = "memory_fts"

# ── FTS5 management ──────────────────────────────────────────────────────────

def _fts_conn():
    FTS_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(FTS_DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute(f"CREATE VIRTUAL TABLE IF NOT EXISTS {FTS_TABLE} USING fts5(memory_id, memory, agent_id)")
    conn.commit()
    return conn

def rebuild_fts_index(agent_id: str = "global"):
    """Rebuild FTS5 from mem0 history DB. Run after bulk imports."""
    from mem_client import MEMORY_DIR
    history_db = MEMORY_DIR / f"history_{agent_id}.db"
    if not history_db.exists():
        return {"status": "no_history_db", "indexed": 0}

    conn = _fts_conn()
    conn.execute(f"DELETE FROM {FTS_TABLE} WHERE agent_id = ?", (agent_id,))

    hist = sqlite3.connect(str(history_db))
    hist.row_factory = sqlite3.Row
    rows = hist.execute("""
        SELECT h.memory_id, h.new_memory AS memory
        FROM history h
        INNER JOIN (
            SELECT memory_id, MAX(rowid) AS max_rowid
            FROM history WHERE is_deleted = 0 GROUP BY memory_id
        ) latest ON h.memory_id = latest.memory_id AND h.rowid = latest.max_rowid
        WHERE h.event != 'DELETE' AND h.new_memory IS NOT NULL
    """).fetchall()
    hist.close()

    for row in rows:
        conn.execute(f"INSERT INTO {FTS_TABLE}(memory_id, memory, agent_id) VALUES (?,?,?)",
                     (row["memory_id"], row["memory"], agent_id))
    conn.commit()
    count = len(rows)
    conn.close()
    return {"status": "rebuilt", "agent_id": agent_id, "indexed": count}

def index_single_memory(memory_id: str, memory_text: str, agent_id: str = "global"):
    conn = _fts_conn()
    conn.execute(f"DELETE FROM {FTS_TABLE} WHERE memory_id = ?", (memory_id,))
    conn.execute(f"INSERT INTO {FTS_TABLE}(memory_id, memory, agent_id) VALUES (?,?,?)",
                 (memory_id, memory_text, agent_id))
    conn.commit()
    conn.close()

# ── BM25 search ──────────────────────────────────────────────────────────────

def bm25_search(query: str, agent_id: str = "global", limit: int = 20):
    conn = _fts_conn()
    try:
        rows = conn.execute(
            f"SELECT memory_id, memory, bm25({FTS_TABLE}) AS score "
            f"FROM {FTS_TABLE} WHERE {FTS_TABLE} MATCH ? AND agent_id = ? "
            f"ORDER BY score LIMIT ?",
            (query, agent_id, limit)
        ).fetchall()
    except Exception:
        escaped = '"' + query.replace('"', '""') + '"'
        try:
            rows = conn.execute(
                f"SELECT memory_id, memory, bm25({FTS_TABLE}) AS score "
                f"FROM {FTS_TABLE} WHERE {FTS_TABLE} MATCH ? AND agent_id = ? "
                f"ORDER BY score LIMIT ?",
                (escaped, agent_id, limit)
            ).fetchall()
        except Exception:
            conn.close()
            return []
    conn.close()
    return [{"memory_id": r["memory_id"], "memory": r["memory"], "bm25_score": -r["score"]} for r in rows]

# ── Temporal decay ────────────────────────────────────────────────────────────

def apply_temporal_decay(results, half_life_days=DEFAULT_HALF_LIFE_DAYS):
    decay_lambda = math.log(2) / half_life_days
    now = datetime.now(timezone.utc)
    for item in results:
        ts_str = item.get("updated_at") or item.get("created_at") or ""
        try:
            ts = datetime.fromisoformat(str(ts_str)) if ts_str else now
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            age_days = (now - ts).total_seconds() / 86400
        except Exception:
            age_days = 0
        base = item.get("score", item.get("fused_score", 0.5))
        item["age_days"] = round(age_days, 1)
        item["decayed_score"] = base * math.exp(-decay_lambda * age_days)
    return results

# ── MMR diversity ─────────────────────────────────────────────────────────────

def _tokenize(text):
    return set(re.findall(r"\w+", text.lower()))

def _jaccard(a, b):
    return len(a & b) / len(a | b) if (a and b) else 0.0

def apply_mmr(results, limit, mmr_lambda=DEFAULT_MMR_LAMBDA):
    if not results or limit <= 0:
        return results[:limit]
    for item in results:
        item["_tokens"] = _tokenize(item.get("memory", ""))
    candidates = sorted(results, key=lambda x: x.get("decayed_score", 0), reverse=True)
    selected = [candidates.pop(0)]
    while len(selected) < limit and candidates:
        best_score, best_idx = -float("inf"), 0
        for i, cand in enumerate(candidates):
            rel = cand.get("decayed_score", 0)
            max_sim = max(_jaccard(cand["_tokens"], s["_tokens"]) for s in selected)
            mmr = mmr_lambda * rel - (1 - mmr_lambda) * max_sim
            if mmr > best_score:
                best_score, best_idx = mmr, i
        selected.append(candidates.pop(best_idx))
    for item in selected:
        item.pop("_tokens", None)
    return selected

# ── Main search ───────────────────────────────────────────────────────────────

def smart_search(query: str, agent_id: str = "global", limit: int = 10,
                 vector_weight=DEFAULT_VECTOR_WEIGHT, text_weight=DEFAULT_TEXT_WEIGHT,
                 half_life_days=DEFAULT_HALF_LIFE_DAYS, mmr_lambda=DEFAULT_MMR_LAMBDA):
    """
    Hybrid memory search: vector similarity + BM25 keyword fusion,
    temporal decay, MMR diversity. Agent-scoped.
    Returns {"results": [...]} matching mem0 format.
    """
    fetch_limit = max(limit * 3, 15)

    # Vector search (requires embeddings — CPU available, always works)
    from mem_client import get_memory_client
    m = get_memory_client(agent_id)
    try:
        raw = m.search(query, user_id=MEMORY_USER_ID, limit=fetch_limit)
        raw_results = raw.get("results", []) if isinstance(raw, dict) else (raw or [])
    except Exception:
        raw_results = []

    items = []
    for r in raw_results:
        items.append({
            "id": r.get("id", ""),
            "memory": r.get("memory", ""),
            "vector_score": r.get("score", 0),
            "created_at": r.get("created_at", ""),
            "updated_at": r.get("updated_at", ""),
        })

    # BM25 — always works (SQLite local)
    bm25_results = bm25_search(query, agent_id=agent_id, limit=fetch_limit)
    bm25_lookup = {r["memory_id"]: r["bm25_score"] for r in bm25_results}

    # Add BM25-only hits
    vec_ids = {item["id"] for item in items}
    for br in bm25_results:
        if br["memory_id"] not in vec_ids:
            items.append({
                "id": br["memory_id"], "memory": br["memory"],
                "vector_score": 0, "created_at": "", "updated_at": "",
            })

    if not items:
        return {"results": []}

    # Normalize vector scores
    vscores = [item["vector_score"] for item in items]
    vlo, vhi = min(vscores), max(vscores)
    vspread = vhi - vlo if vhi > vlo else 1.0
    for item in items:
        item["vector_score"] = (item["vector_score"] - vlo) / vspread

    # BM25 scores
    max_bm25 = max(bm25_lookup.values()) if bm25_lookup else 1.0
    for item in items:
        item["bm25_score"] = (bm25_lookup.get(item["id"], 0) / max_bm25) if max_bm25 > 0 else 0

    # Fuse
    for item in items:
        item["fused_score"] = vector_weight * item["vector_score"] + text_weight * item["bm25_score"]
        item["score"] = item["fused_score"]

    # Temporal decay + MMR
    apply_temporal_decay(items, half_life_days)
    for item in items:
        item["score"] = item["decayed_score"]
    final = apply_mmr(items, limit, mmr_lambda)

    output = []
    for item in final:
        output.append({
            "id": item["id"],
            "memory": item["memory"],
            "score": round(item.get("decayed_score", 0), 4),
            "created_at": item.get("created_at", ""),
            "updated_at": item.get("updated_at", ""),
            "debug": {
                "vector": round(item.get("vector_score", 0), 4),
                "bm25":   round(item.get("bm25_score", 0), 4),
                "fused":  round(item.get("fused_score", 0), 4),
                "age_days": item.get("age_days", 0),
            },
        })
    return {"results": output}


def main():
    parser = argparse.ArgumentParser(description="Smart hybrid memory search")
    parser.add_argument("--query",         required=False)
    parser.add_argument("--agent-id",      default="global")
    parser.add_argument("--limit",         type=int, default=10)
    parser.add_argument("--vector-weight", type=float, default=DEFAULT_VECTOR_WEIGHT)
    parser.add_argument("--text-weight",   type=float, default=DEFAULT_TEXT_WEIGHT)
    parser.add_argument("--rebuild-index", action="store_true")
    args = parser.parse_args()

    if args.rebuild_index:
        print(json.dumps(rebuild_fts_index(args.agent_id), indent=2))
        return

    if not args.query:
        parser.error("--query required (or --rebuild-index)")

    results = smart_search(args.query, agent_id=args.agent_id, limit=args.limit,
                           vector_weight=args.vector_weight, text_weight=args.text_weight)
    print(json.dumps(results, indent=2, default=str))


if __name__ == "__main__":
    main()
