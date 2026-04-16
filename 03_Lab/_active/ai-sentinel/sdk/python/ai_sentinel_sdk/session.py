"""Session context manager for stateful multi-turn conversations."""

from __future__ import annotations
import uuid
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .client import SentinelClient, AsyncSentinelClient
    from .models import CheckResponse


class SessionContext:
    """
    Manages a session_id across multiple check_input / check_output calls.

    Usage (sync):
        with SentinelClient(...) as sentinel:
            with SessionContext(sentinel, session_id="chat-123") as session:
                session.check_input("What is the capital of France?")
                session.check_output("The capital of France is Paris.")

    Usage (async):
        async with AsyncSentinelClient(...) as sentinel:
            async with AsyncSessionContext(sentinel, session_id="chat-123") as session:
                await session.check_input("What is the capital of France?")
    """

    def __init__(
        self,
        client: "SentinelClient",
        session_id: Optional[str] = None,
    ):
        self.client = client
        self.session_id = session_id or str(uuid.uuid4())

    def check_input(self, prompt, **kwargs) -> "CheckResponse":
        return self.client.check_input(prompt, session_id=self.session_id, **kwargs)

    def check_output(self, response, **kwargs) -> "CheckResponse":
        return self.client.check_output(response, session_id=self.session_id, **kwargs)

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass


class AsyncSessionContext:
    """Async version of SessionContext."""

    def __init__(
        self,
        client: "AsyncSentinelClient",
        session_id: Optional[str] = None,
    ):
        self.client = client
        self.session_id = session_id or str(uuid.uuid4())

    async def check_input(self, prompt, **kwargs) -> "CheckResponse":
        return await self.client.check_input(prompt, session_id=self.session_id, **kwargs)

    async def check_output(self, response, **kwargs) -> "CheckResponse":
        return await self.client.check_output(response, session_id=self.session_id, **kwargs)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        pass
