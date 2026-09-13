"""Outbound email drafting workflow. Sending remains owned by the authenticated web service."""

from __future__ import annotations

import json
import logging
import re

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.config import get_settings

logger = logging.getLogger(__name__)


class DraftResult(BaseModel):
    to: str | None = None
    subject: str | None = None
    body: str | None = None
    assumptions: list[str] = Field(default_factory=list)
    clarification: str | None = None


def _extract_json(value: str) -> dict:
    cleaned = value.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, flags=re.S | re.I)
    return json.loads(fenced.group(1) if fenced else cleaned)


async def create_draft(user_request: str) -> DraftResult | str:
    settings = get_settings()
    if not settings.openrouter_api_key:
        return "The drafting provider is not configured."
    prompt = (
        "You are an email drafting assistant. Convert the user's explicit request into a "
        "reviewable email draft. Return JSON only with exactly these keys: to, subject, "
        "body, assumptions, clarification. Use null for unknown to/subject/body. "
        "If the request does not contain an exact email address, set clarification to a "
        "short question asking for it and leave to null. Never invent an address. If the "
        "purpose is materially unclear, ask one clarification question. Keep the body "
        "natural, specific, and grounded only in the request. Do not claim the email was "
        "sent. assumptions must be an array of short strings.\n\nUser request:\n" + user_request
    )
    try:
        async with httpx.AsyncClient(timeout=settings.openrouter_timeout_seconds) as client:
            for attempt in range(3):
                response = await client.post(
                    f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.openrouter_api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": settings.allowed_origins[0] if settings.allowed_origins else "http://localhost:3000",
                        "X-Title": "Gmail Agent",
                    },
                    json={"model": settings.openrouter_model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2},
                )
                if response.is_success:
                    result = DraftResult.model_validate(_extract_json(response.json()["choices"][0]["message"]["content"]))
                    if result.to and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", result.to):
                        return "Please provide a valid recipient email address."
                    if result.to and result.subject and result.body:
                        return result
                    return result.clarification or "Please provide the recipient and purpose for this email."
                logger.warning("Draft provider rejected request: status=%s attempt=%s response=%s", response.status_code, attempt + 1, response.text[:1000])
                if response.status_code not in {408, 409, 429, 500, 502, 503, 504} or attempt == 2:
                    return "The drafting provider is temporarily unavailable."
        return "The drafting provider is temporarily unavailable."
    except (httpx.HTTPError, KeyError, IndexError, TypeError, json.JSONDecodeError, ValidationError) as error:
        logger.exception("Draft provider request failed: type=%s", type(error).__name__)
        return "The drafting provider is temporarily unavailable."
