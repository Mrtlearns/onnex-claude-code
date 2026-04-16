#!/usr/bin/env python3
"""Async usage example."""

import asyncio
from ai_sentinel_sdk import AsyncSentinelClient
from ai_sentinel_sdk.session import AsyncSessionContext

SENTINEL_URL = "http://localhost:8080"

async def main():
    async with AsyncSentinelClient(base_url=SENTINEL_URL, caller_id="async-app") as sentinel:
        health = await sentinel.health()
        print(f"AI-Sentinel status: {health}")

        async with AsyncSessionContext(sentinel, session_id="async-session-001") as session:
            resp = await session.check_input({"content": "Summarize this medical report"})
            print(f"Input OK -- latency: {resp.latency_ms}ms")

            # Check output
            output = "The patient's blood pressure was 140/90 mmHg."
            resp = await session.check_output({"content": output})
            safe_output = resp.payload or output
            print(f"Output OK: {safe_output}")

if __name__ == "__main__":
    asyncio.run(main())
