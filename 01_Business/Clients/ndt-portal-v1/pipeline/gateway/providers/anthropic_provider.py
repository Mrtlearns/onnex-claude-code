"""Anthropic (Claude) LLM provider for gateway service."""
from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "shared"))
from config import anthropic_api_key  # noqa: E402

import anthropic

_client: anthropic.AsyncAnthropic | None = None

MODEL = "claude-sonnet-4-6"


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=anthropic_api_key())
    return _client


async def call(
    prompt: str,
    system_prompt: str | None = None,
    max_tokens: int = 4096,
    images: list | None = None,   # list of ImagePayload
) -> tuple[dict, int | None, int | None]:
    """Call Claude and return (parsed_json_or_text, input_tokens, output_tokens).

    Returns the response as a dict with key 'text' containing the raw response,
    plus 'parsed' if the response is valid JSON.
    """
    client = get_client()
    system = system_prompt or (
        "You are an expert NDT (Non-Destructive Testing) quote analyst. "
        "Extract structured information from the provided text. "
        "Respond with valid JSON only."
    )

    if images:
        content: list | str = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": img.media_type,
                    "data": img.data_b64,
                },
            }
            for img in images
        ] + [{"type": "text", "text": prompt}]
    else:
        content = prompt

    messages = [{"role": "user", "content": content}]

    response = await client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=messages,
    )

    text = response.content[0].text if response.content else ""
    input_tokens  = response.usage.input_tokens  if response.usage else None
    output_tokens = response.usage.output_tokens if response.usage else None

    import json
    parsed = None
    try:
        # Try to extract JSON from response (may be wrapped in markdown)
        json_start = text.find("{")
        json_end   = text.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            parsed = json.loads(text[json_start:json_end])
    except Exception:
        pass

    return {"text": text, "parsed": parsed or {"raw": text}}, input_tokens, output_tokens
