import asyncio

import pytest

from app import guardrails


def test_classifier_flags_financial_message(monkeypatch):
    monkeypatch.setattr(guardrails, "_classifier", lambda: lambda *_args, **_kwargs: {
        "labels": ["financial or banking information", "medical or health information", "personal identity or private information", "sensitive information that needs user review"],
        "scores": [0.91, 0.04, 0.08, 0.02],
    })
    result = asyncio.run(guardrails.preflight("user-1", guardrails.MessageEnvelope(message_id="m-1", subject="Bank statement")))
    assert result.decision == "permission_required"
    assert result.categories == ["financial"]


def test_obvious_promotion_does_not_require_consent(monkeypatch):
    def model_must_not_run():
        raise AssertionError("model should not be needed for an obvious promotion")

    monkeypatch.setattr(guardrails, "_classifier", model_must_not_run)
    result = asyncio.run(guardrails.preflight("user-1", guardrails.MessageEnvelope(message_id="m-ad", subject="50% sale today", snippet="Limited time offer. Unsubscribe anytime.")))
    assert result.decision == "allow"
    assert result.categories == []


def test_known_news_and_retail_senders_do_not_require_consent(monkeypatch):
    monkeypatch.setattr(guardrails, "_classifier", lambda: (_ for _ in ()).throw(AssertionError("fallback should classify benign senders")))
    for sender in ["Bloomberg <news@bloomberg.com>", "McDonald's <updates@mcdonalds.com>", "IndiGo <offers@goindigo.in>", "LinkedIn <news@linkedin.com>"]:
        result = asyncio.run(guardrails.preflight("user-1", guardrails.MessageEnvelope(message_id="m-benign", sender=sender, subject="Your daily update")))
        assert result.decision == "allow"


def test_social_and_travel_activity_requires_consent(monkeypatch):
    monkeypatch.setattr(guardrails, "_classifier", lambda: (_ for _ in ()).throw(AssertionError("high-risk rules should run before the model")))
    cases = [
        ("LinkedIn <notifications@linkedin.com>", "Your private message has arrived"),
        ("Air India <updates@airindia.com>", "Your booking confirmation AB12CD"),
        ("PVR <tickets@pvr.com>", "Your ticket and seat are confirmed"),
    ]
    for sender, subject in cases:
        result = asyncio.run(guardrails.preflight("user-1", guardrails.MessageEnvelope(message_id="m-sensitive", sender=sender, subject=subject)))
        assert result.decision == "permission_required"


def test_booking_promotion_is_allowed_but_cab_invoice_is_protected(monkeypatch):
    monkeypatch.setattr(guardrails, "_classifier", lambda: (_ for _ in ()).throw(AssertionError("rules should classify these envelopes")))
    promotion = asyncio.run(guardrails.preflight("user-1", guardrails.MessageEnvelope(message_id="m-promo", sender="Airline Offers <offers@airline.example>", subject="Save up to 40% on bookings")))
    invoice = asyncio.run(guardrails.preflight("user-1", guardrails.MessageEnvelope(message_id="m-invoice", sender="City Cabs <billing@cab.example>", subject="Your ride invoice")))
    assert promotion.decision == "allow"
    assert invoice.decision == "permission_required"
    assert invoice.categories == ["personal"]


def test_classifier_flags_medical_and_personal_message(monkeypatch):
    monkeypatch.setattr(guardrails, "_classifier", lambda: lambda *_args, **_kwargs: {
        "labels": ["financial or banking information", "medical or health information", "personal identity or private information", "sensitive information that needs user review"],
        "scores": [0.02, 0.82, 0.78, 0.01],
    })
    result = asyncio.run(guardrails.preflight("user-1", guardrails.MessageEnvelope(message_id="m-2", subject="Clinic results")))
    assert result.decision == "permission_required"
    assert result.categories == ["medical", "personal"]


def test_ordinary_messages_open_when_classifier_is_unavailable(monkeypatch, caplog):
    def fail():
        raise RuntimeError("model unavailable")

    monkeypatch.setattr(guardrails, "_classifier", fail)
    for subject in ["Check", "Hello", "Meeting tomorrow"]:
        result = asyncio.run(guardrails.preflight("user-1", guardrails.MessageEnvelope(message_id=f"m-{subject}", subject=subject)))
        assert result.decision == "allow"
        assert result.categories == []
    assert "Check" not in caplog.text


def test_ambiguous_message_requires_permission_when_classifier_is_unavailable(monkeypatch, caplog):
    monkeypatch.setattr(guardrails, "_classifier", lambda: (_ for _ in ()).throw(RuntimeError("model unavailable")))
    result = asyncio.run(guardrails.preflight("user-1", guardrails.MessageEnvelope(message_id="m-ambiguous-failure", subject="Please review this request")))
    assert result.decision == "permission_required"
    assert result.categories == []
    assert "Please review this request" not in caplog.text


@pytest.mark.parametrize(
    "envelope",
    [
        guardrails.MessageEnvelope(message_id="m-financial", subject="Bank statement"),
        guardrails.MessageEnvelope(message_id="m-medical", subject="Clinic results"),
        guardrails.MessageEnvelope(message_id="m-otp", snippet="Your verification code is 123456"),
        guardrails.MessageEnvelope(message_id="m-booking", subject="Your booking confirmation"),
        guardrails.MessageEnvelope(message_id="m-reply-to", sender="Example <alerts@example.com>", reply_to="support@different.example", subject="Please verify your account"),
        guardrails.MessageEnvelope(message_id="m-auth", sender="Example <alerts@example.com>", authentication_results="spf=fail"),
        guardrails.MessageEnvelope(message_id="m-link", snippet="Review https://bit.ly/check-now"),
    ],
)
def test_risk_signals_stay_protected_when_classifier_is_unavailable(monkeypatch, envelope):
    monkeypatch.setattr(guardrails, "_classifier", lambda: (_ for _ in ()).throw(RuntimeError("model unavailable")))
    result = asyncio.run(guardrails.preflight("user-1", envelope))
    assert result.decision == "permission_required"


def test_ambiguous_sensitivity_prediction_does_not_prompt(monkeypatch):
    monkeypatch.setattr(guardrails, "_classifier", lambda: lambda *_args, **_kwargs: {
        "labels": ["financial or banking information", "medical or health information", "personal identity or private information", "sensitive information that needs user review", "phishing or social engineering language"],
        "scores": [0.61, 0.58, 0.54, 0.52, 0.11],
    })
    result = asyncio.run(guardrails.preflight("user-1", guardrails.MessageEnvelope(message_id="m-ambiguous", subject="Your regular update")))
    assert result.decision == "allow"
    assert result.categories == []
    assert result.phishing.risk_level == "low_risk"
