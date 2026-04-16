# /cleanup

Audit the current project for stray files at the root and propose reorganization.
Run periodically after heavy development sessions or when the project root feels cluttered.

---

## What This Command Does

Scans the current project root for files that don't belong there and proposes where they should go. Does NOT move or delete anything without explicit confirmation.

---

## Step 1: Identify the project root

Determine the current working directory. This is the project being audited.

---

## Step 2: Scan for stray files

List all files directly at the project root (not in subdirectories). Classify each one:

**Legitimate root files (leave in place — do not flag):**
- CLAUDE.md, README.md, LICENSE
- docker-compose.yml, docker-compose.yaml, Dockerfile
- .gitignore, .gitattributes, .env, .env.example
- Cargo.toml, Cargo.lock, package.json, package-lock.json, pyproject.toml, uv.lock
- tsconfig.json, tailwind.config.*, vite.config.*, next.config.*
- Makefile, nginx.conf, .gitlab-ci.yml, .mcp.json
- Any other framework-mandated root config files

**Stray files (flag for review):**

| Extension | Proposed destination |
|-----------|---------------------|
| .py, .sh, .bash, .ps1 | scripts/ |
| .html, .htm (standalone) | outputs/ |
| .txt, .log, .csv, .tsv | outputs/ |
| .md (non-README/CLAUDE) | plans/ or docs/ |
| .json (non-package/config) | outputs/ or context/ |
| .yaml/.yml (non-docker/traefik) | plans/ or context/ |
| temp_*, test_*, patch_*, debug_* | scripts/ (if useful) or delete |
| *_addition.txt, *_schema.txt | outputs/ or delete |

---

## Step 3: Present findings

Show a table of stray files with proposed destinations:

```
CLEANUP AUDIT — <project-name>
================================

Stray files found at root:

  FILE                          PROPOSED DESTINATION        ACTION
  ──────────────────────────────────────────────────────────────────
  patch_compose.py              scripts/                    move
  web_api_client_addition.txt   outputs/                    move or delete?
  test_pipeline.js              scripts/                    move
  deploy_dashboard.py           scripts/                    move

Legitimate root files (no action needed):
  CLAUDE.md, docker-compose.yml, Cargo.toml, .gitignore ...

Legend: move = propose mkdir + mv | delete = propose removal
```

---

## Step 4: Ask for confirmation per action

For each stray file, ask:
- Move to proposed destination? (y/n)
- Delete instead? (y/n)
- Leave in place? (y/n)

Or offer a bulk option: "Move all scripts to scripts/, all outputs to outputs/? (y/n)"

---

## Step 5: Execute approved moves

For each confirmed move:

```bash
# Create destination if needed
mkdir -p scripts/   # or outputs/, plans/

# Move the file
mv patch_compose.py scripts/
```

---

## Step 6: Check outputs/ and scripts/ for stale content

After moving, also scan:
- `outputs/` — flag files older than 30 days without recent edits (candidates for archive)
- `scripts/` — flag one-off patch scripts that were used once and are no longer needed
- `.claude/state/sessions/` — summarize session count and oldest session date

Present findings but do NOT delete anything without explicit confirmation.

---

## Step 7: Summary

```
CLEANUP COMPLETE — <project-name>
===================================
Moved:   3 files
Deleted: 0 files
Skipped: 1 file (left at root by choice)

Project root is now clean.
Run /cleanup again after the next heavy development session.
```

---

## Notes

- Never delete CLAUDE.md, README.md, LICENSE, or .git/ contents
- If unsure about a file — skip it and ask the user
- For AI-OS-POC specifically: patch_*.py and *_addition.txt files are migration artifacts — move to scripts/ if still needed, delete if the migration is complete
- The pre-tool-safety hook will ALERT on future root writes — use /cleanup to address any that slip through
