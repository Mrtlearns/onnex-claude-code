"""Claude CLI (OAuth) provider for gateway service.

Uses ``claude -p --input-format stream-json --output-format stream-json``
with CLAUDE_CODE_OAUTH_TOKEN auth. Supports both text and multimodal (image)
inputs — images are embedded as base64 blocks in the stream-json message.

Token is read from /claude-token-store/token.json (bind-mounted from host)
with a fallback to the CLAUDE_CODE_OAUTH_TOKEN env var.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path

logger = logging.getLogger("gateway.claude_cli")

TOKEN_FILE = "/claude-token-store/token.json"
CLAUDE_BIN = "claude"
DEFAULT_MODEL = "claude-sonnet-4-6"
TIMEOUT_SECS = 300.0


def read_oauth_token() -> str:
    """Read OAuth token from bind-mounted file, fall back to env var."""
    try:
        data = json.loads(Path(TOKEN_FILE).read_text())
        token = data.get("claude_oauth_token") or data.get("token", "")
        if token:
            return token
    except Exception:
        pass
    return os.environ.get("CLAUDE_CODE_OAUTH_TOKEN", "")


def _build_message(
    prompt: str,
    images: list | None = None,
) -> bytes:
    """Build a stream-json user message including any image payloads.

    Images are passed as base64 image blocks before the text prompt,
    matching the Anthropic API content block format.
    """
    content: list[dict] = []

    if images:
        for img in images:
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": img.media_type,
                    "data": img.data_b64,
                },
            })

    content.append({"type": "text", "text": prompt})

    msg = {
        "type": "user",
        "message": {
            "role": "user",
            "content": content,
        },
    }
    return json.dumps(msg).encode()


def _parse_stream_json(raw: str) -> str:
    """Extract response text from claude stream-json output.

    Looks for the ``result`` line first; falls back to the last assistant
    message content block.
    """
    text = ""
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue

        obj_type = obj.get("type", "")

        if obj_type == "result":
            return obj.get("result", "")

        if obj_type == "assistant":
            for block in obj.get("message", {}).get("content", []):
                if block.get("type") == "text":
                    text = block["text"]

    return text


async def call(
    prompt: str,
    system_prompt: str | None = None,
    max_tokens: int = 4096,
    images: list | None = None,
    model: str | None = None,
) -> tuple[dict, int | None, int | None]:
    """Call Claude via CLI subprocess with optional image inputs.

    Returns (response_dict, input_tokens, output_tokens).
    Token counts are None — stream-json output doesn't expose usage counts.

    Raises RuntimeError if token is missing or CLI exits non-zero.
    """
    token = read_oauth_token()
    if not token:
        raise RuntimeError(
            "No Claude OAuth token available. "
            "Save one via Settings → Claude Auth tab."
        )

    resolved_model = model or DEFAULT_MODEL

    cmd = [
        CLAUDE_BIN, "-p",
        "--verbose",
        "--input-format", "stream-json",
        "--output-format", "stream-json",
        "--no-session-persistence",
        "--model", resolved_model,
    ]
    if system_prompt:
        cmd += ["--system-prompt", system_prompt]

    stdin_data = _build_message(prompt, images)

    env = {
        **os.environ,
        "CLAUDE_CODE_OAUTH_TOKEN": token,
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    }

    try:
        logger.info(
            "claude_cli_provider: spawning claude, model=%s images=%d stdin_len=%d",
            resolved_model, len(images or []), len(stdin_data),
        )
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        logger.info("claude_cli_provider: pid=%d waiting for output...", proc.pid)
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=stdin_data), timeout=TIMEOUT_SECS
        )
        logger.info("claude_cli_provider: got output, rc=%d stdout_len=%d", proc.returncode, len(stdout))
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        raise RuntimeError(f"claude CLI timed out after {TIMEOUT_SECS}s")

    if proc.returncode != 0:
        err_text = stderr.decode(errors="replace")[:500]
        raise RuntimeError(
            f"claude CLI exited with rc={proc.returncode}: {err_text}"
        )

    raw = stdout.decode(errors="replace")
    text = _parse_stream_json(raw)

    if not text:
        # Fallback: if parsing produced nothing, return the raw stdout
        text = raw.strip()

    # Try to extract JSON from the model's response text
    parsed = None
    try:
        # Strip markdown code fences if present (```json ... ``` or ``` ... ```)
        clean = text.strip()
        if clean.startswith("```"):
            # Remove opening fence (with optional language tag) and closing fence
            first_nl = clean.find("\n")
            last_fence = clean.rfind("```", 3)
            if first_nl > 0 and last_fence > first_nl:
                clean = clean[first_nl + 1:last_fence].strip()

        json_start = clean.find("{")
        json_end = clean.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            parsed = json.loads(clean[json_start:json_end])
    except json.JSONDecodeError as e:
        logger.warning("claude_cli_provider: JSON parse failed: %s (text_len=%d)", e, len(text))

    has_images = bool(images)
    logger.info(
        "claude_cli_provider: model=%s multimodal=%s rc=%d text_len=%d parsed=%s",
        resolved_model,
        has_images,
        proc.returncode,
        len(text),
        "ok" if (parsed and "raw" not in parsed) else "FAILED",
    )

    if parsed is None:
        logger.error(
            "claude_cli_provider: JSON extraction returned None. First 500 chars: %s",
            text[:500],
        )

    return {"text": text, "parsed": parsed or {"raw": text}}, None, None
