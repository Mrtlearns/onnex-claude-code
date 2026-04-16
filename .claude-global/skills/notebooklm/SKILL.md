# Skill: NotebookLM

Unofficial Python API and CLI for Google NotebookLM — full programmatic access.
Repo: https://github.com/teng-lin/notebooklm-py
Installed: notebooklm-py v0.3.4 in WSL at /home/mrt/.local/bin/notebooklm

---

## What It Does

Provides programmatic access to NotebookLM features beyond what the web UI exposes:
- Source-grounded Q&A over PDFs, URLs, docs, YouTube
- Audio podcast/overview generation
- Quiz, flashcard, mind map, slide deck, infographic generation
- Structured exports (JSON, Markdown, CSV, PPTX)
- Chat history preservation as notebook notes
- Batch downloads

---

## When to Apply

- TRIGGER: User asks to query documents with source citations
- TRIGGER: User wants to generate an audio overview or podcast from documents
- TRIGGER: "NotebookLM", "notebook", "grounded research", "source-cited"
- TRIGGER: Client document review or due diligence tasks
- TRIGGER: Building a research pipeline from PDFs/reports

---

## CLI Reference

All commands run as: `wsl python3 -c "import subprocess; subprocess.run(['/home/mrt/.local/bin/notebooklm', ...])`
Or: set up alias `notebooklm` = `/home/mrt/.local/bin/notebooklm` in WSL.

```bash
# Authentication (one-time, interactive browser)
notebooklm login

# Notebook management
notebooklm create "Notebook Name"
notebooklm list
notebooklm use <notebook_id>

# Add sources
notebooklm source add "https://example.com"
notebooklm source add "./document.pdf"
notebooklm source add-research "topic"   # auto web research + import

# Query
notebooklm ask "What are the key findings?"

# Generate content
notebooklm generate audio "make it engaging" --wait
notebooklm generate quiz --difficulty hard
notebooklm generate flashcards --quantity more
notebooklm generate slide-deck
notebooklm generate mind-map
notebooklm generate data-table "custom structure"

# Download artifacts
notebooklm download audio ./podcast.mp3
notebooklm download quiz --format json ./quiz.json
notebooklm download flashcards --format markdown ./cards.md
notebooklm download slide-deck ./slides.pdf
notebooklm download mind-map ./map.json
notebooklm download data-table ./data.csv

# Diagnostics
notebooklm auth check --test
```

---

## Python API

```python
import asyncio
from notebooklm import NotebookLMClient

async def main():
    async with await NotebookLMClient.from_storage() as client:
        nb = await client.notebooks.create("Research")
        await client.sources.add_url(nb.id, "https://example.com", wait=True)
        result = await client.chat.ask(nb.id, "Summarize this")
        print(result.answer)

asyncio.run(main())
```

---

## Onnex Usage Patterns

- Client onboarding → create notebook, add client docs → grounded Q&A
- Research pipelines → Firecrawl → NotebookLM sources → export to Obsidian
- Deliverable generation → slide decks and audio overviews for client reports
- Due diligence → upload contracts/reports → ask specific compliance questions

---

## Auth Config Storage

Credentials stored at: `~/.notebooklm/` (WSL: `/home/mrt/.notebooklm/`)
Profile: `storage_state.json`, `context.json`, `browser_profile/`

---

## Status
NEEDS AUTHENTICATION — run `! wsl python3 -c "import subprocess; subprocess.run(['/home/mrt/.local/bin/notebooklm', 'login'])"` to authenticate via browser.
