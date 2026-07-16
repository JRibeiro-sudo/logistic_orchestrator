"""Shared Anthropic SDK wrapper used by every AI-reasoning stage.

Every call here requests structured JSON and validates it against a pydantic
model before returning. Model names are read from environment variables only
(TRIAGE_MODEL for the fast/cheap tier, REASONING_MODEL for the stronger
tier) — never hardcoded. On invalid JSON or a schema violation, the model
is given one corrective turn before this raises.
"""

from __future__ import annotations

import json
import os
from typing import TypeVar

from anthropic import Anthropic
from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)

_client: Anthropic | None = None


def get_client() -> Anthropic:
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY environment variable is not set. "
                "This prototype never reads API keys from anywhere else."
            )
        _client = Anthropic(api_key=api_key)
    return _client


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines)
    return text.strip()


def call_structured(
    *,
    model_env_var: str,
    system_prompt: str,
    user_prompt: str,
    response_model: type[T],
    temperature: float,
    max_tokens: int,
    max_retries: int = 2,
) -> T:
    model = os.environ.get(model_env_var)
    if not model:
        raise RuntimeError(
            f"{model_env_var} environment variable is not set. Model names are "
            "never hardcoded in this prototype — set it before running."
        )

    client = get_client()
    schema = response_model.model_json_schema()
    full_system = (
        f"{system_prompt}\n\n"
        "Respond with ONLY a single JSON object matching this JSON Schema. "
        "No prose, no markdown code fences, no commentary — JSON only.\n"
        f"Schema:\n{json.dumps(schema)}"
    )

    messages: list[dict] = [{"role": "user", "content": user_prompt}]
    last_error: Exception | None = None

    for _ in range(max_retries + 1):
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=full_system,
            messages=messages,
        )
        text = "".join(block.text for block in response.content if block.type == "text")
        try:
            data = json.loads(_strip_fences(text))
            return response_model.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as exc:
            last_error = exc
            messages.append({"role": "assistant", "content": text})
            messages.append(
                {
                    "role": "user",
                    "content": (
                        f"Your previous response was invalid JSON or failed schema "
                        f"validation: {exc}. Reply again with ONLY corrected JSON "
                        "matching the schema."
                    ),
                }
            )

    raise RuntimeError(
        f"LLM did not produce valid structured output after {max_retries + 1} attempts: {last_error}"
    )
