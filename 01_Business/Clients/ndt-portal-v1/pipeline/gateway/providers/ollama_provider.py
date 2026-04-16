"""Ollama (local RTX 3090) LLM provider for gateway service.

Reaches Ollama running natively on the ndtv1 host via host.gateway.internal:11434.
Model: llama3.3:70b

The extra_hosts entry in docker-compose.yml maps:
  host.gateway.internal → host-gateway (Docker host IP)
"""
from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "shared"))
from config import ollama_url  # noqa: E402

import httpx

MODEL = "llama3.3:70b"
# Ollama can be slow for 70B — give it 5 minutes
TIMEOUT = httpx.Timeout(300.0, connect=10.0)


async def call(
    prompt: str,
    system_prompt: str | None = None,
    max_tokens: int = 2048,
    images: list | None = None,   # list of ImagePayload
    model: str | None = None,     # override for vision model (e.g. "llava:34b")
) -> tuple[dict, int | None, int | None]:
    """Call Ollama /api/chat and return (response_dict, prompt_tokens, completion_tokens)."""
    base_url = ollama_url()
    use_model = model or MODEL
    system = system_prompt or (
        "You are an expert NDT (Non-Destructive Testing) quote analyst. "
        "Extract structured information from the provided text. "
        "Respond with valid JSON only."
    )

    user_msg: dict = {"role": "user", "content": prompt}
    if images:
        user_msg["images"] = [img.data_b64 for img in images]

    payload = {
        "model":  use_model,
        "stream": False,
        "options": {"num_predict": max_tokens},
        "messages": [
            {"role": "system",  "content": system},
            user_msg,
        ],
    }

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(f"{base_url}/api/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()

    text = data.get("message", {}).get("content", "")
    prompt_eval_count  = data.get("prompt_eval_count")
    eval_count         = data.get("eval_count")

    import json
    parsed = None
    try:
        json_start = text.find("{")
        json_end   = text.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            parsed = json.loads(text[json_start:json_end])
    except Exception:
        pass

    return {"text": text, "parsed": parsed or {"raw": text}}, prompt_eval_count, eval_count
