#!/usr/bin/env python3
"""Basic synchronous usage example."""

from ai_sentinel_sdk import SentinelClient
from ai_sentinel_sdk.session import SessionContext
from ai_sentinel_sdk.policy import PolicyBuilder

SENTINEL_URL = "http://localhost:8080"

def main():
    policy = PolicyBuilder().max_tokens(4096).drift_threshold(0.6).build()

    with SentinelClient(base_url=SENTINEL_URL, caller_id="example-app") as sentinel:
        # Check health
        health = sentinel.health()
        print(f"AI-Sentinel status: {health}")

        # Guard an input
        try:
            resp = sentinel.check_input(
                {"content": "What is the capital of France?"},
            )
            print(f"Input allowed -- latency: {resp.latency_ms}ms")
        except ValueError as e:
            print(f"Input blocked: {e}")

        # Session-scoped multi-turn conversation
        with SessionContext(sentinel, session_id="demo-session-001") as session:
            for prompt in [
                "What medications treat hypertension?",
                "How do ACE inhibitors work?",
                "What are common side effects of beta blockers?",
            ]:
                try:
                    resp = session.check_input({"content": prompt})
                    print(f"Allowed: {prompt[:50]}...")
                except ValueError as e:
                    print(f"Blocked: {e}")

if __name__ == "__main__":
    main()
