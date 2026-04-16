#!/usr/bin/env python3
"""
evolve.py — Merge, deduplicate, and prune instincts using LLM analysis.

Usage:
    python3 evolve.py               # Evolve all instincts
    python3 evolve.py --scope ndtv1 # Evolve project-specific instincts
    python3 evolve.py --dry-run     # Preview changes without writing
"""

import argparse
import json
import os
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))
from mem0_client import DATA_DIR, sanitize, is_online

INSTINCTS_FILE = DATA_DIR / 'instincts.jsonl'

def load_all_instincts() -> list:
    if not INSTINCTS_FILE.exists():
        return []
    instincts = []
    with open(INSTINCTS_FILE) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    instincts.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return instincts

def save_instincts(instincts: list):
    INSTINCTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(INSTINCTS_FILE, 'w') as f:
        for inst in instincts:
            f.write(json.dumps(inst) + '\n')

def evolve_with_llm(instincts: list, scope: str = None) -> dict:
    """Use OpenRouter to analyze instincts and suggest merges/prunes."""
    # Load env
    env_file = DATA_DIR / '.env'
    with open(env_file, 'r', encoding='utf-8-sig') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

    filtered = [i for i in instincts
                if i.get('status') == 'active'
                and (scope is None or i.get('scope') in (scope, 'global'))]

    if len(filtered) < 2:
        return {'merged': [], 'pruned': [], 'unchanged': filtered}

    # Build numbered list for LLM
    numbered = '\n'.join(
        f'{i+1}. [{inst["id"]}] (conf:{inst["confidence"]}) {inst["pattern"]}'
        for i, inst in enumerate(filtered)
    )

    from openai import OpenAI
    client = OpenAI(
        api_key=os.environ['OPENROUTER_API_KEY'],
        base_url='https://openrouter.ai/api/v1',
    )

    prompt = f"""You are analyzing a list of learned patterns (instincts) for an AI coding assistant.
Your task: identify duplicates to merge, contradictions to resolve, and weak entries to prune.

INSTINCTS:
{numbered}

Return JSON with this exact structure:
{{
  "merge_groups": [
    {{
      "ids": ["inst_xxx", "inst_yyy"],
      "merged_pattern": "single clear merged pattern",
      "confidence": 0.9,
      "reason": "why merged"
    }}
  ],
  "prune_ids": ["inst_zzz"],
  "prune_reasons": {{"inst_zzz": "too vague / contradicts inst_xxx"}},
  "confidence_updates": {{"inst_aaa": 0.95}}
}}

Rules:
- Only merge if patterns genuinely cover the same concept
- Only prune if confidence < 0.4 or directly contradicted
- Prefer to keep specificity — don't over-merge
- Return empty arrays if no action needed
"""

    response = client.chat.completions.create(
        model=os.getenv('OPENROUTER_MODEL', 'openai/gpt-4o-mini'),
        messages=[{'role': 'user', 'content': prompt}],
        max_tokens=1500,
        temperature=0.1,
        response_format={'type': 'json_object'},
    )

    try:
        return json.loads(response.choices[0].message.content)
    except Exception:
        return {'merge_groups': [], 'prune_ids': [], 'prune_reasons': {}, 'confidence_updates': {}}

def apply_evolution(instincts: list, evolution: dict, dry_run: bool = False) -> list:
    """Apply LLM evolution decisions to the instinct list."""
    from learning_capture import save_instinct

    now = datetime.now().strftime('%Y-%m-%d')
    prune_ids = set(evolution.get('prune_ids', []))
    merge_groups = evolution.get('merge_groups', [])
    conf_updates = evolution.get('confidence_updates', {})

    # IDs to remove (pruned + merged originals)
    merged_source_ids = set()
    for group in merge_groups:
        merged_source_ids.update(group.get('ids', []))

    remove_ids = prune_ids | merged_source_ids

    # Filter out removed instincts
    updated = []
    for inst in instincts:
        if inst['id'] in remove_ids:
            if not dry_run:
                pass  # skip (effectively deleted)
            continue
        # Apply confidence updates
        if inst['id'] in conf_updates:
            if not dry_run:
                inst['confidence'] = conf_updates[inst['id']]
                inst['last_seen'] = now
        updated.append(inst)

    # Add merged instincts
    for group in merge_groups:
        new_inst = {
            'id': f'inst_evolved_{now.replace("-", "")}_{len(updated)}',
            'pattern': group['merged_pattern'],
            'scope': 'global',
            'confidence': group.get('confidence', 0.85),
            'status': 'active',
            'context': [],
            'source': 'evolved',
            'first_seen': now,
            'last_seen': now,
            'reinforcement_count': len(group.get('ids', [])),
            'merged_from': group.get('ids', []),
            'merge_reason': group.get('reason', ''),
        }
        updated.append(new_inst)
        if dry_run:
            print(f'  MERGE: {group.get("ids", [])} → "{new_inst["pattern"][:60]}"')

    if dry_run:
        for pid in prune_ids:
            print(f'  PRUNE: {pid}')
        for iid, conf in conf_updates.items():
            print(f'  UPDATE CONF: {iid} → {conf}')

    return updated

def main():
    parser = argparse.ArgumentParser(description='Evolve and refine instincts')
    parser.add_argument('--scope', type=str, default=None,
                        help='Scope to evolve (default: all active)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview changes without writing')
    args = parser.parse_args()

    if not is_online():
        print('Offline — evolution requires OpenRouter. Run again when connected.')
        sys.exit(0)

    instincts = load_all_instincts()
    active = [i for i in instincts if i.get('status') == 'active']
    print(f'Loaded {len(instincts)} instincts ({len(active)} active)')

    if len(active) < 2:
        print('Not enough instincts to evolve (need ≥ 2 active).')
        return

    print('Analyzing with LLM...')
    evolution = evolve_with_llm(instincts, scope=args.scope)

    merge_count = len(evolution.get('merge_groups', []))
    prune_count = len(evolution.get('prune_ids', []))
    conf_count  = len(evolution.get('confidence_updates', {}))

    print(f'LLM decisions: {merge_count} merges, {prune_count} prunes, {conf_count} confidence updates')

    if merge_count == 0 and prune_count == 0 and conf_count == 0:
        print('No changes needed — instincts are already well-organized.')
        return

    updated = apply_evolution(instincts, evolution, dry_run=args.dry_run)

    if not args.dry_run:
        save_instincts(updated)
        print(f'Done — {len(instincts)} → {len(updated)} instincts')
    else:
        print(f'\nDry run: {len(instincts)} → {len(updated)} instincts (no files changed)')

if __name__ == '__main__':
    main()
