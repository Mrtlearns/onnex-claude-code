"""Sync and async HTTP clients for the AI-Sentinel API."""

from __future__ import annotations
import uuid
from typing import Any, Optional
import httpx

from .models import (
    CheckRequest, CheckResponse, CheckStatus,
    Direction, CallerContext, CallerType,
)


class _ClientBase:
    """Shared configuration."""

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: Optional[str] = None,
        caller_id: str = "python-sdk",
        caller_type: CallerType = CallerType.sdk,
        tenant_id: Optional[str] = None,
        timeout: float = 10.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.caller_id = caller_id
        self.caller_type = caller_type
        self.tenant_id = tenant_id
        self._headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            self._headers["Authorization"] = f"Bearer {api_key}"
        self._timeout = timeout

    def _build_request(
        self,
        direction: Direction,
        payload: Any,
        session_id: Optional[str] = None,
    ) -> CheckRequest:
        return CheckRequest(
            direction=direction,
            payload=payload,
            session_id=session_id,
            caller_context=CallerContext(
                caller_id=self.caller_id,
                caller_type=self.caller_type,
                tenant_id=self.tenant_id,
            ),
        )


class SentinelClient(_ClientBase):
    """Synchronous AI-Sentinel client."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._http = httpx.Client(
            base_url=self.base_url,
            headers=self._headers,
            timeout=self._timeout,
        )

    def check(self, request: CheckRequest) -> CheckResponse:
        """Send a check request and return the response."""
        resp = self._http.post("/check", content=request.model_dump_json())
        resp.raise_for_status()
        return CheckResponse.model_validate(resp.json())

    def check_input(
        self,
        prompt: Any,
        session_id: Optional[str] = None,
    ) -> CheckResponse:
        """Guard an LLM input (ingress). Raises ValueError if rejected."""
        req = self._build_request(Direction.Ingress, prompt, session_id)
        resp = self.check(req)
        if resp.status == CheckStatus.Reject:
            detail = resp.reject
            raise ValueError(
                f"Input blocked by AI-Sentinel [{detail.layer}/{detail.code}]: {detail.reason}"
            )
        return resp

    def check_output(
        self,
        response: Any,
        session_id: Optional[str] = None,
    ) -> CheckResponse:
        """Guard an LLM output (egress). Returns mutated payload if PII was stripped."""
        req = self._build_request(Direction.Egress, response, session_id)
        resp = self.check(req)
        if resp.status == CheckStatus.Reject:
            detail = resp.reject
            raise ValueError(
                f"Output blocked by AI-Sentinel [{detail.layer}/{detail.code}]: {detail.reason}"
            )
        return resp

    def health(self) -> dict:
        return self._http.get("/health").json()

    def close(self):
        self._http.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


class AsyncSentinelClient(_ClientBase):
    """Asynchronous AI-Sentinel client."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._http = httpx.AsyncClient(
            base_url=self.base_url,
            headers=self._headers,
            timeout=self._timeout,
        )

    async def check(self, request: CheckRequest) -> CheckResponse:
        resp = await self._http.post("/check", content=request.model_dump_json())
        resp.raise_for_status()
        return CheckResponse.model_validate(resp.json())

    async def check_input(
        self,
        prompt: Any,
        session_id: Optional[str] = None,
    ) -> CheckResponse:
        req = self._build_request(Direction.Ingress, prompt, session_id)
        resp = await self.check(req)
        if resp.status == CheckStatus.Reject:
            detail = resp.reject
            raise ValueError(
                f"Input blocked by AI-Sentinel [{detail.layer}/{detail.code}]: {detail.reason}"
            )
        return resp

    async def check_output(
        self,
        response: Any,
        session_id: Optional[str] = None,
    ) -> CheckResponse:
        req = self._build_request(Direction.Egress, response, session_id)
        resp = await self.check(req)
        if resp.status == CheckStatus.Reject:
            detail = resp.reject
            raise ValueError(
                f"Output blocked by AI-Sentinel [{detail.layer}/{detail.code}]: {detail.reason}"
            )
        return resp

    async def health(self) -> dict:
        resp = await self._http.get("/health")
        return resp.json()

    async def aclose(self):
        await self._http.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        await self.aclose()
