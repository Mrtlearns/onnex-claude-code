from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from pydantic import BaseModel


class TestConfig(BaseModel):
    mode: str = "single"            # "single" | "auto"
    rate: float = 5.0               # req/s (auto mode)
    violation_pct: int = 60         # 0-100
    duration_min: int = 5           # auto mode duration
    concurrency: int = 1
    severity_filter: list[str] = ["low", "medium", "high", "critical"]


class TestResult(BaseModel):
    seq: int
    run_id: str
    test_id: str
    name: str
    category: str
    direction: str
    severity: str
    expected: str                   # "pass" | "reject"
    expected_layer: str
    description: str
    actual: str                     # "pass" | "reject"
    actual_layer: Optional[str]     # layer that triggered reject, if any
    actual_code: Optional[str]      # reject code
    outcome: str                    # "pass" | "fail" (did actual == expected?)
    latency_ms: int
    error: Optional[str] = None     # network/timeout error


class RunStatus(BaseModel):
    running: bool
    run_id: Optional[str]
    mode: Optional[str]
    elapsed_s: float
    total_sent: int
    passed: int
    failed: int
    total_tests: int                # 22 for single pass, 0 for auto (unbounded)
