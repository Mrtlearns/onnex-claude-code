from __future__ import annotations

import asyncio
import random
import time
import uuid
from typing import Optional

import httpx

from .models import RunStatus, TestConfig, TestResult
from .test_suite import CLEAN_CASES, VIOLATION_CASES, GAP_CASES, TEST_CASES, TestCase


class BackgroundRunner:
    def __init__(self, agentsec_url: str) -> None:
        self._url = agentsec_url.rstrip("/") + "/check"
        self._task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()
        self._results: list[TestResult] = []
        self._run_id: Optional[str] = None
        self._mode: Optional[str] = None
        self._start_time: float = 0.0
        self._total_sent: int = 0
        self._passed: int = 0
        self._failed: int = 0
        self._total_tests: int = 0
        self._seq: int = 0
        # SSE subscriber queues
        self._subscribers: set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()

    # ── Subscriber management ──────────────────────────────────────────────

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    def _publish(self, result: TestResult) -> None:
        for q in list(self._subscribers):
            try:
                q.put_nowait(result)
            except asyncio.QueueFull:
                pass

    # ── Control ────────────────────────────────────────────────────────────

    async def start(self, cfg: TestConfig) -> str:
        await self.stop()
        self._run_id = str(uuid.uuid4())[:8]
        self._mode = cfg.mode
        self._start_time = time.time()
        self._total_sent = 0
        self._passed = 0
        self._failed = 0
        self._seq = 0
        self._stop.clear()

        if cfg.mode == "single":
            self._total_tests = len(TEST_CASES)
            self._task = asyncio.create_task(self._run_single(cfg))
        else:
            self._total_tests = 0  # unbounded
            self._task = asyncio.create_task(self._run_auto(cfg))

        return self._run_id

    async def stop(self) -> None:
        self._stop.set()
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
        self._task = None

    def clear(self) -> None:
        self._results.clear()
        self._run_id = None
        self._mode = None
        self._start_time = 0.0
        self._total_sent = 0
        self._passed = 0
        self._failed = 0
        self._seq = 0
        self._total_tests = 0

    # ── Status ─────────────────────────────────────────────────────────────

    def status(self) -> RunStatus:
        running = self._task is not None and not self._task.done()
        elapsed = time.time() - self._start_time if self._start_time else 0.0
        return RunStatus(
            running=running,
            run_id=self._run_id,
            mode=self._mode,
            elapsed_s=round(elapsed, 1),
            total_sent=self._total_sent,
            passed=self._passed,
            failed=self._failed,
            total_tests=self._total_tests,
        )

    # ── Run modes ──────────────────────────────────────────────────────────

    async def _run_single(self, cfg: TestConfig) -> None:
        """Fire all test cases once, respecting concurrency."""
        sem = asyncio.Semaphore(max(1, cfg.concurrency))
        async with httpx.AsyncClient(timeout=10.0) as client:
            for tc in TEST_CASES:
                if self._stop.is_set():
                    break
                if tc.severity not in cfg.severity_filter:
                    continue
                async with sem:
                    result = await self._fire(client, tc)
                    await self._record(result)

    async def _run_auto(self, cfg: TestConfig) -> None:
        """Continuously fire tests weighted by violation_pct until duration or stop."""
        deadline = self._start_time + cfg.duration_min * 60
        interval = 1.0 / max(0.1, cfg.rate)
        sem = asyncio.Semaphore(max(1, cfg.concurrency))

        eligible_violations = [
            tc for tc in VIOLATION_CASES if tc.severity in cfg.severity_filter
        ]
        # Include gap cases in the "clean" pool — they pass, so they contribute to clean traffic
        eligible_clean = [
            tc for tc in (CLEAN_CASES + GAP_CASES) if tc.severity in cfg.severity_filter
        ]
        if not eligible_violations and not eligible_clean:
            return

        async with httpx.AsyncClient(timeout=10.0) as client:
            while not self._stop.is_set() and time.time() < deadline:
                roll = random.randint(0, 99)
                if roll < cfg.violation_pct and eligible_violations:
                    tc = random.choice(eligible_violations)
                elif eligible_clean:
                    tc = random.choice(eligible_clean)
                else:
                    tc = random.choice(eligible_violations)

                async with sem:
                    result = await self._fire(client, tc)
                    await self._record(result)

                await asyncio.sleep(interval)

    # ── Core fire ──────────────────────────────────────────────────────────

    async def _fire(self, client: httpx.AsyncClient, tc: TestCase) -> TestResult:
        t0 = time.monotonic()
        actual = "pass"
        actual_layer = None
        actual_code = None
        error = None

        try:
            resp = await client.post(self._url, json=tc.payload)
            data = resp.json()
            actual = data.get("status", "pass")
            if actual == "reject" and data.get("reject"):
                actual_layer = data["reject"].get("layer")
                actual_code = data["reject"].get("code")
        except Exception as exc:
            actual = "error"
            error = str(exc)

        latency_ms = int((time.monotonic() - t0) * 1000)
        outcome = "pass" if actual == tc.expected else "fail"

        return TestResult(
            seq=self._next_seq(),
            run_id=self._run_id or "?",
            test_id=tc.id,
            name=tc.name,
            category=tc.category,
            direction=tc.direction,
            severity=tc.severity,
            expected=tc.expected,
            expected_layer=tc.expected_layer,
            description=tc.description,
            actual=actual,
            actual_layer=actual_layer,
            actual_code=actual_code,
            outcome=outcome,
            latency_ms=latency_ms,
            error=error,
        )

    async def _record(self, result: TestResult) -> None:
        async with self._lock:
            self._results.append(result)
            self._total_sent += 1
            if result.outcome == "pass":
                self._passed += 1
            else:
                self._failed += 1
        self._publish(result)

    def _next_seq(self) -> int:
        self._seq += 1
        return self._seq
