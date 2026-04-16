"""OpenAI LLM provider for gateway service.

Uses the standard OpenAI chat completions API.
"""
from __future__ import annotations

import httpx

OPENAI_BASE = "https://api.openai.com/v1"


async def call(
    prompt: str,
    system_prompt: str | None = None,
    model: str = "gpt-4o",
    api_key: str = "",
    max_tokens: int = 4096,
    images: list | None = None,   # list of ImagePayload
) -> tuple[dict, int | None, int | None]:
    """Call OpenAI and return (response_dict, input_tokens, output_tokens).

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

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{OPENAI_BASE}/chat/completions",
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
