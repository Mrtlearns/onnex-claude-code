# Skill: Autoresearch (Karpathy)

Autonomous research agent that runs multi-step web research pipelines.
Repo: https://github.com/karpathy/autoresearch

---

## What It Does

Autoresearch orchestrates iterative search → read → synthesize loops autonomously.
Given a research question, it fans out searches, reads sources, and produces a structured report.
Pairs naturally with the existing `/research` skill for deeper investigation.

---

## When to Apply

- TRIGGER: User asks for deep research on a topic (more than 3 search iterations)
- TRIGGER: User says "run autoresearch on..."
- TRIGGER: `/research` produces insufficient depth

Use `/research` for quick lookups. Use autoresearch for multi-hour autonomous pipelines.

---

## Setup

```bash
# Clone and install (WSL or Windows)
git clone https://github.com/karpathy/autoresearch D:/Code/Claude/.claude-global/tools/autoresearch
cd D:/Code/Claude/.claude-global/tools/autoresearch
pip install -r requirements.txt
```

Requires:
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in environment
- Python 3.10+

---

## Usage Pattern

```bash
wsl python3 /mnt/d/Code/Claude/.claude-global/tools/autoresearch/main.py \
  --query "Your research question here" \
  --output /mnt/d/Code/Claude/outputs/research/
```

Output is a structured markdown report saved to the outputs folder.

---

## Integration with /research Skill

- Use `/research` tier: **Quick** or **Standard** for ad-hoc lookups
- Use autoresearch for: competitive analysis, technology surveys, client industry deep-dives
- Save autoresearch outputs to Obsidian vault: `Research/<topic>.md`

---

## Status
NEEDS CONFIGURATION — see configuration prompt.
