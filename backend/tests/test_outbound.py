import json
import asyncio

import pytest

from app import outbound


class FakeResponse:
    def __init__(self, status_code: int, payload: dict) -> None:
        self.status_code = status_code
        self._payload = payload
        self.text = json.dumps(payload)

    @property
    def is_success(self) -> bool:
        return 200 <= self.status_code < 300

    def json(self) -> dict:
        return self._payload


class FakeClient:
    responses: list[FakeResponse] = []
    requests: list[dict] = []

    def __init__(self, *args, **kwargs) -> None:
        self.responses = type(self).responses
        self.requests = type(self).requests

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args) -> None:
        return None

    async def post(self, url: str, **kwargs):
        self.requests.append(kwargs)
        return self.responses.pop(0)


@pytest.fixture(autouse=True)
def fake_provider(monkeypatch):
    class Settings:
        openrouter_api_key = "test-key"
        openrouter_base_url = "https://provider.test/v1"
        openrouter_model = "test-model"
        openrouter_timeout_seconds = 1
        allowed_origins = ["http://localhost:3000"]

    FakeClient.responses = []
    FakeClient.requests = []
    monkeypatch.setattr(outbound, "get_settings", lambda: Settings())
    monkeypatch.setattr(outbound.httpx, "AsyncClient", FakeClient)


def test_draft_is_grounded_and_requires_exact_recipient():
    FakeClient.responses.append(FakeResponse(200, {"choices": [{"message": {"content": json.dumps({
        "to": "alex@example.com",
        "subject": "Thank you for the introduction",
        "body": "Thanks for making the introduction. I appreciate it.",
        "assumptions": ["The tone should be warm."],
        "clarification": None,
    })}}]}))

    result = asyncio.run(outbound.create_draft("Write to alex@example.com thanking them for the introduction."))

    assert result.to == "alex@example.com"
    assert result.subject == "Thank you for the introduction"
    assert "introduction" in result.body
    assert "sent" not in result.body.lower()


def test_missing_recipient_returns_clarification_without_sendable_draft():
    FakeClient.responses.append(FakeResponse(200, {"choices": [{"message": {"content": json.dumps({
        "to": None,
        "subject": None,
        "body": None,
        "assumptions": [],
        "clarification": "What is the recipient's exact email address?",
    })}}]}))

    result = asyncio.run(outbound.create_draft("Write a short thank-you email."))

    assert isinstance(result, str)
    assert "recipient" in result.lower()


def test_provider_rate_limit_retries_then_succeeds():
    FakeClient.responses.extend([
        FakeResponse(429, {"error": "rate limited"}),
        FakeResponse(200, {"choices": [{"message": {"content": json.dumps({
            "to": "alex@example.com", "subject": "Hello", "body": "Hello Alex.", "assumptions": [], "clarification": None,
        })}}]}),
    ])

    result = asyncio.run(outbound.create_draft("Write to alex@example.com saying hello."))

    assert result.to == "alex@example.com"
    assert len(FakeClient.requests) == 2
