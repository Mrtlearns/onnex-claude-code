from __future__ import annotations

import json
import os
from typing import AsyncIterator

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from .models import RunStatus, TestConfig
from .runner import BackgroundRunner

AGENTSEC_URL = os.getenv("AGENTSEC_URL", "http://agentsec:8080")

app = FastAPI(title="AI-Sentinel Tester", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

runner = BackgroundRunner(AGENTSEC_URL)


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.post("/api/run")
async def run(cfg: TestConfig):
    """Start a test run (single pass or auto mode)."""
    run_id = await runner.start(cfg)
    return {"run_id": run_id, "mode": cfg.mode}


@app.post("/api/stop")
async def stop():
    """Stop an active run."""
    await runner.stop()
    return {"status": "stopped"}


@app.get("/api/stream")
async def stream():
    """SSE stream: replays buffered results then pushes new ones live."""
    async def event_gen() -> AsyncIterator[dict]:
        q = runner.subscribe()
        try:
            # Replay buffer first
            for result in list(runner._results):
                yield {"data": result.model_dump_json()}

            # Then stream new events
            while True:
                try:
                    result = await q.get()
                    yield {"data": result.model_dump_json()}
                except Exception:
                    break
        finally:
            runner.unsubscribe(q)

    return EventSourceResponse(event_gen(), ping=2)


@app.get("/api/results")
async def results():
    """Return all buffered results as a JSON array."""
    return [r.model_dump() for r in runner._results]


@app.delete("/api/results")
async def clear():
    """Clear results and stop any active run."""
    await runner.stop()
    runner.clear()
    return {"status": "cleared"}


@app.get("/api/export")
async def export():
    """Download all results as a JSON file."""
    data = json.dumps([r.model_dump() for r in runner._results], indent=2)
    return Response(
        content=data,
        media_type="application/json",
        headers={
            "Content-Disposition": "attachment; filename=sentinel-test-results.json"
        },
    )


@app.get("/api/status")
async def status() -> RunStatus:
    """Current run status."""
    return runner.status()
