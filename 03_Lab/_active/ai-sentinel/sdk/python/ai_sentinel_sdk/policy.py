"""Policy configuration builder for per-caller overrides."""

from __future__ import annotations
from typing import Optional


class PolicyBuilder:
    """
    Fluent builder for constructing config_override payloads.

    Usage:
        policy = (
            PolicyBuilder()
            .max_tokens(4096)
            .max_actions_per_hour(500)
            .drift_threshold(0.6)
            .build()
        )
        sentinel.check_input(prompt, config_override=policy)
    """

    def __init__(self):
        self._config: dict = {}

    def max_tokens(self, n: int) -> "PolicyBuilder":
        self._config["rate_max_tokens_per_request"] = n
        return self

    def max_actions_per_hour(self, n: int) -> "PolicyBuilder":
        self._config["rate_max_actions_per_hour"] = n
        return self

    def max_cost_per_day(self, usd: float) -> "PolicyBuilder":
        self._config["rate_max_cost_per_day"] = usd
        return self

    def drift_threshold(self, threshold: float) -> "PolicyBuilder":
        """L3 cosine similarity threshold (0.0-1.0). Lower = more permissive."""
        self._config["l3_drift_threshold"] = threshold
        return self

    def disable_pii_strip(self) -> "PolicyBuilder":
        self._config["layer_l1_enabled"] = False
        return self

    def build(self) -> dict:
        return dict(self._config)
