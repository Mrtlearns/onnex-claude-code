"""Google Gemini LLM provider for gateway service.

Uses the Gemini REST API (v1beta generateContent endpoint).
"""
from __future__ import annotations

import httpx

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


async def call(
    prompt: str,
    system_prompt: str | None = None,
    model: str = "gemini-1.5-flash",
    api_key: str = "",
    max_tokens: int = 1024,
) -> tuple[dict, int | None, int | None]:
    """Call Gemini and return (response_dict, input_tokens, output_tokens).

    Returns a dict with keys 'text' and 'parsed' (parsed JSON if applicable),
    matching the contract expected by gateway_server.py.
    """
    system = system_prompt or (
        "You are an expert NDT (Non-Destructive Testing) quote analyst. "
        "Extract structured information from the provided text. "
        "Respond with valid JSON only."
    )

    url = f"{GEMINI_BASE}/models/{model}:generateContent?key={api_key}"

    payload = {
        "system_instruction": {
            "parts": [{"text": system}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
        },
    }

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, json=payload)
        r.raise_for_status()
        data = r.json()

    content = data["candidates"][0]["content"]["parts"][0]["text"]
    usage_meta = data.get("usageMetadata", {})
    input_tokens  = usage_meta.get("promptTokenCount")
    output_tokens = usage_meta.get("candidatesTokenCount")

    import json
    parsed = None
    try:
        json_start = content.find("{")
        json_end   = content.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            parsed = json.loads(content[json_start:json_end])
    except Exception:
        pass

    return {"text": content, "parsed": parsed or {"raw": content}}, input_tokens, output_tokens
