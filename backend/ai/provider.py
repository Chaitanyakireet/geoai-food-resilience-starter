"""LLM provider abstraction. The application must work with no provider
configured (deterministic fallback, backend/ai/fallback.py) and must never
expose a provider secret to the frontend -- the API key is read from an
environment variable server-side only and never appears in any response
body.

Uses `requests` (already a backend dependency) to call the Anthropic
Messages API directly rather than adding a new SDK dependency.
"""
from __future__ import annotations

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

import requests

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_MODEL = "claude-sonnet-5"
REQUEST_TIMEOUT_SECONDS = 30


@dataclass
class ToolUseBlock:
    id: str
    name: str
    input: dict


@dataclass
class ProviderResponse:
    text_blocks: list[str] = field(default_factory=list)
    tool_uses: list[ToolUseBlock] = field(default_factory=list)
    stop_reason: Optional[str] = None
    raw: Optional[dict] = None

    @property
    def text(self) -> str:
        return "\n".join(self.text_blocks)


class LLMProvider(ABC):
    name: str = "unknown"

    @abstractmethod
    def is_configured(self) -> bool: ...

    @abstractmethod
    def complete(self, system: str, messages: list[dict], tools: list[dict]) -> ProviderResponse: ...


class NullProvider(LLMProvider):
    """No API key configured. Never fabricates a response -- the
    orchestrator must check is_configured() and use the deterministic
    fallback instead of calling complete()."""

    name = "none"

    def is_configured(self) -> bool:
        return False

    def complete(self, system: str, messages: list[dict], tools: list[dict]) -> ProviderResponse:
        raise RuntimeError("NullProvider has no configured API key -- use the deterministic fallback instead.")


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL):
        self._api_key = api_key
        self.model = model

    def is_configured(self) -> bool:
        return bool(self._api_key)

    def complete(self, system: str, messages: list[dict], tools: list[dict]) -> ProviderResponse:
        payload = {
            "model": self.model,
            "max_tokens": 1536,
            "system": system,
            "messages": messages,
        }
        if tools:
            payload["tools"] = tools

        resp = requests.post(
            ANTHROPIC_API_URL,
            headers={
                "x-api-key": self._api_key,
                "anthropic-version": ANTHROPIC_VERSION,
                "content-type": "application/json",
            },
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        data = resp.json()

        text_blocks: list[str] = []
        tool_uses: list[ToolUseBlock] = []
        for block in data.get("content", []):
            if block.get("type") == "text":
                text_blocks.append(block.get("text", ""))
            elif block.get("type") == "tool_use":
                tool_uses.append(ToolUseBlock(id=block["id"], name=block["name"], input=block.get("input", {})))

        return ProviderResponse(text_blocks=text_blocks, tool_uses=tool_uses, stop_reason=data.get("stop_reason"), raw=data)


def get_provider() -> LLMProvider:
    """Reads AI_PROVIDER / ANTHROPIC_API_KEY / AI_MODEL from the environment
    each call (cheap, and lets tests monkeypatch env vars without needing a
    process restart). Defaults to Anthropic if a key is present, else
    NullProvider -- never a hard-coded provider assumption."""
    provider_name = os.environ.get("AI_PROVIDER", "anthropic").lower()
    if provider_name == "anthropic":
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if api_key:
            return AnthropicProvider(api_key=api_key, model=os.environ.get("AI_MODEL", DEFAULT_MODEL))
    return NullProvider()
