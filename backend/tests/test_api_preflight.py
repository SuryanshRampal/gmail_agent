from fastapi.testclient import TestClient

from app import main
from app.guardrails import SensitivityResult


def test_preflight_requires_agent_authentication(monkeypatch):
    monkeypatch.setattr(main.settings, "agent_service_key", "test-agent-key")
    client = TestClient(main.app, raise_server_exceptions=False)
    response = client.post(
        "/agent/preflight",
        json={"message_id": "m-1", "subject": "Newsletter"},
        headers={"X-User-Id": "user-1"},
    )
    assert response.status_code == 401


def test_preflight_requires_authenticated_user(monkeypatch):
    monkeypatch.setattr(main.settings, "agent_service_key", "test-agent-key")
    client = TestClient(main.app, raise_server_exceptions=False)
    response = client.post(
        "/agent/preflight",
        json={"message_id": "m-1", "subject": "Newsletter"},
        headers={"X-Agent-Key": "test-agent-key"},
    )
    assert response.status_code == 401


def test_preflight_accepts_only_bounded_envelope(monkeypatch):
    monkeypatch.setattr(main.settings, "agent_service_key", "test-agent-key")
    called = {}

    async def fake_preflight(user_id, envelope):
        called["user_id"] = user_id
        called["envelope"] = envelope
        return SensitivityResult(decision="allow", warning="")

    monkeypatch.setattr(main, "preflight", fake_preflight)
    client = TestClient(main.app)
    response = client.post(
        "/agent/preflight",
        json={"message_id": "m-1", "subject": "Newsletter", "snippet": "Short preview"},
        headers={"X-Agent-Key": "test-agent-key", "X-User-Id": "user-1"},
    )
    assert response.status_code == 200
    assert response.json()["result"]["decision"] == "allow"
    assert called["user_id"] == "user-1"
    assert called["envelope"].snippet == "Short preview"

    oversized = client.post(
        "/agent/preflight",
        json={"message_id": "m-1", "snippet": "x" * 6001},
        headers={"X-Agent-Key": "test-agent-key", "X-User-Id": "user-1"},
    )
    assert oversized.status_code == 422


def test_preflight_returns_fail_closed_assessment_without_logging_content(monkeypatch, caplog):
    monkeypatch.setattr(main.settings, "agent_service_key", "test-agent-key")
    secret = "private-account-number-123456"

    async def failed_preflight(_user_id, _envelope):
        raise RuntimeError(secret)

    monkeypatch.setattr(main, "preflight", failed_preflight)
    client = TestClient(main.app, raise_server_exceptions=False)
    response = client.post(
        "/agent/preflight",
        json={"message_id": "m-1", "snippet": secret},
        headers={"X-Agent-Key": "test-agent-key", "X-User-Id": "user-1"},
    )
    assert response.status_code == 500
    assert secret not in caplog.text


def test_preflight_serializes_phishing_result(monkeypatch):
    monkeypatch.setattr(main.settings, "agent_service_key", "test-agent-key")

    async def fake_preflight(_user_id, _envelope):
        return SensitivityResult(
            decision="permission_required",
            warning="Review before opening.",
            phishing={
                "risk_level": "high_risk",
                "confidence_band": "high",
                "reasons": ["The sender authentication results include a failure."],
                "link_count": 0,
                "bounded": True,
            },
        )

    monkeypatch.setattr(main, "preflight", fake_preflight)
    client = TestClient(main.app)
    response = client.post(
        "/agent/preflight",
        json={"message_id": "m-1", "sender": "Example <alerts@example.com>"},
        headers={"X-Agent-Key": "test-agent-key", "X-User-Id": "user-1"},
    )
    assert response.status_code == 200
    assert response.json()["result"]["phishing"]["risk_level"] == "high_risk"
