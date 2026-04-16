"""OpenRouter LLM provider for gateway service.

OpenRouter exposes an OpenAI-compatible API supporting 100+ models
including free-tier options. The 'openrouter/auto' meta-model selects
the best available free model for each request.
"""
from __future__ import annotations

import os

import httpx

OPENROUTER_BASE = "https://openrouter.ai/api/v1"


async def call(
    prompt: str,
    system_prompt: str | None = None,
    model: str = "openrouter/auto",
    api_key: str = "",
    max_tokens: int = 4096,
    images: list | None = None,   # list of ImagePayload
) -> tuple[dict, int | None, int | None]:
    """Call OpenRouter and return (response_dict, input_tokens, output_tokens).

    Returns a dict with keys 'text' and 'parsed' (parsed JSON if applicable),
    matching the contract expected by gateway_server.py.
    """
    system = system_prompt or (
        "You are an expert NDT (Non-Destructive Testing) quote analyst. "
        "Extract structured information from the provided text. "
        "Respond with valid JSON only."
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": f"https://{os.environ.get('PORTAL_DOMAIN', 'ndt-v1.on-nex.us')}",
        "X-Title": "NDT Portal Pipeline",
    }

    if images:
        user_content: list | str = [
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{img.media_type};base64,{img.data_b64}",
                    "detail": "high",
                },
            }
            for img in images
        ] + [{"type": "text", "text": prompt}]
    else:
        user_content = prompt

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user_content},
        ],
        "max_tokens": max_tokens,
    }

    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            f"{OPENROUTER_BASE}/chat/completions",
            json=payload,
            headers=headers,
        )
        r.raise_for_status()
        data = r.json()

    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    input_tokens  = usage.get("prompt_tokens")
    output_tokens = usage.get("completion_tokens")

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
