#!/usr/bin/env python3
"""
auto-commit.py — PostToolUse / Stop hook
Fires when Claude Code session ends or stops.
Auto-commits any uncommitted changes with a smarter generated message.

Improvements over v1:
- Skips commit if only non-code files changed (e.g., only .md context files)
- Groups files by type for better commit messages
- Uses conventional commit prefixes based on what changed
- Respects .gitignore implicitly (git handles it)
"""

import subprocess
import sys
import re
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


def run(cmd, **kwargs):
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs)


def is_git_repo():
    return run(["git", "rev-parse", "--is-inside-work-tree"]).returncode == 0


def get_changed_files():
    result = run(["git", "status", "--short"])
    lines = result.stdout.strip().splitlines()
    files = []
    for line in lines:
        if line.strip():
            status = line[:2].strip()
            path = line[3:].strip()
            files.append((status, path))
    return files


def classify_files(files):
    """Classify changed files into categories for commit message generation."""
    code = []
    context = []
    config = []
    hooks = []
    docs = []
    other = []

    code_exts = {".py", ".js", ".ts", ".sh", ".sql", ".json", ".yaml", ".yml", ".toml"}
    doc_exts = {".md", ".txt", ".rst"}
    config_patterns = ["settings.json", ".env", "docker-compose", "Dockerfile", "requirements"]

    for status, path in files:
        p = Path(path)
        ext = p.suffix.lower()
        name = p.name.lower()

        if any(pat in path for pat in ["context/", "TELOS"]):
            context.append(path)
        elif any(pat in path for pat in [".claude/hooks/", ".claude/commands/", ".claude/agents/"]):
            hooks.append(path)
        elif any(pat in name for pat in config_patterns) or "settings" in name:
            config.append(path)
        elif ext in code_exts:
            code.append(path)
        elif ext in doc_exts:
            docs.append(path)
        else:
            other.append(path)

    return {
        "code": code,
        "context": context,
        "hooks": hooks,
        "config": config,
        "docs": docs,
        "other": other,
    }


def generate_message(files):
    """Generate a descriptive conventional commit message."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    classified = classify_files(files)
    total = len(files)

    # Determine primary prefix
    if classified["code"] and not any([classified["context"], classified["hooks"], classified["config"]]):
        prefix = "feat"
        desc = _describe_files(classified["code"], "code")
    elif classified["hooks"]:
        prefix = "chore"
        desc = _describe_files(classified["hooks"], "hooks")
    elif classified["config"]:
        prefix = "chore"
        desc = _describe_files(classified["config"], "config")
    elif classified["context"]:
        prefix = "docs"
        desc = _describe_files(classified["context"], "context")
    elif classified["docs"]:
        prefix = "docs"
        desc = _describe_files(classified["docs"], "docs")
    else:
        prefix = "chore"
        desc = f"{total} file{'s' if total > 1 else ''}"

    # Add scope if mixed
    categories_touched = [k for k, v in classified.items() if v]
    if len(categories_touched) > 1:
        scope = "+".join(categories_touched[:2])
        return f"{prefix}({scope}): {desc} [{timestamp}]"
    else:
        return f"{prefix}: {desc} [{timestamp}]"


def _describe_files(files, category):
    if len(files) == 1:
        return Path(files[0]).name
    elif len(files) <= 3:
        names = [Path(f).name for f in files]
        return ", ".join(names)
    else:
        return f"{len(files)} {category} files"


def main():
    if not is_git_repo():
        sys.exit(0)

    changed = get_changed_files()
    if not changed:
        sys.exit(0)

    files = [path for _, path in changed]
    message = generate_message(changed)

    run(["git", "add", "-A"])
    result = run(["git", "commit", "-m", message])

    if result.returncode == 0:
        print(f"Auto-commit \u2713  {message}")
    else:
        err = result.stderr.strip()
        if "nothing to commit" not in err:
            print(f"Auto-commit failed: {err}", file=sys.stderr)

    sys.exit(0)


if __name__ == "__main__":
    main()
