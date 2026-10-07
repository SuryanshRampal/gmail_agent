import asyncio

from app import guardrails
from app.phishing import assess_envelope


def test_benign_promotion_is_low_risk():
    result = assess_envelope(sender="PlayStation <email@email.playstation.com>", subject="Marvel's Wolverine is out now", snippet="Unleash your rage on PS5")
    assert result.risk_level == "low_risk"
    assert result.reasons == []


def test_common_benign_mail_categories_remain_low_risk():
    cases = [
        ("Bloomberg <news@bloomberg.com>", "Evening briefing", "Breaking news and daily briefing"),
        ("LinkedIn <notifications@linkedin.com>", "I want to connect", "A professional connection request"),
        ("PlayStation <email@email.playstation.com>", "New releases this week", "Discover new games for PS5"),
        ("Premier League <pl@email.premierleague.com>", "Matchweek review", "A look at the latest performances"),
        ("Airline Offers <offers@airline.example>", "Save up to 40% on bookings", "Flight deals for your next trip"),
        ("McDonald's <updates@mcdonalds.com>", "Your weekly offers", "Enjoy this week's menu offers"),
    ]
    for sender, subject, snippet in cases:
        result = assess_envelope(sender=sender, subject=subject, snippet=snippet)
        assert result.risk_level == "low_risk", (sender, result)


def test_reply_to_mismatch_and_credential_request_are_high_risk():
    result = assess_envelope(sender="Example Bank <alerts@example-bank.com>", reply_to="support@random-mail.click", subject="Verify your account now", snippet="Send your password and OTP to avoid suspension")
    assert result.risk_level == "high_risk"
    assert result.link_count == 0
    assert len(result.reasons) >= 2


def test_reply_to_mismatch_alone_is_not_phishing():
    result = assess_envelope(sender="PlayStation <email@email.playstation.com>", reply_to="campaigns@mailing.example", subject="Wolverine Digital Deluxe Edition")
    assert result.risk_level == "low_risk"
    assert result.reasons == ["The reply address uses a different domain from the visible sender."]


def test_suspicious_links_are_explained():
    result = assess_envelope(sender="Example <alerts@example.com>", subject="Review security alert", snippet="https://bit.ly/verify-now")
    assert result.risk_level == "needs_attention"
    assert result.link_count == 1
    assert any("shortening" in reason for reason in result.reasons)


def test_authentication_failure_and_lookalike_domain_raise_attention():
    result = assess_envelope(sender="Example Bank <alerts@xn--exmple-qta.com>", authentication_results="spf=fail; dkim=fail", subject="Monthly update")
    assert result.risk_level == "high_risk"
    assert any("authentication" in reason for reason in result.reasons)
    assert any("encoded" in reason for reason in result.reasons)


def test_model_phishing_signal_requires_attention(monkeypatch):
    monkeypatch.setattr(guardrails, "_classifier", lambda: lambda *_args, **_kwargs: {
        "labels": ["phishing or social engineering language", "financial or banking information", "medical or health information", "personal identity or private information", "sensitive information that needs user review"],
        "scores": [0.91, 0.02, 0.01, 0.02, 0.01],
    })
    result = asyncio.run(guardrails.preflight("user-1", guardrails.MessageEnvelope(message_id="m-phish", subject="Please review this request")))
    assert result.phishing.risk_level == "needs_attention"
    assert result.decision == "allow"


def test_model_outage_does_not_flag_a_no_signal_message(monkeypatch, caplog):
    monkeypatch.setattr(guardrails, "_classifier", lambda: (_ for _ in ()).throw(RuntimeError("model unavailable")))
    result = asyncio.run(guardrails.preflight("user-1", guardrails.MessageEnvelope(message_id="m-fail", subject="Check")))
    assert result.phishing.risk_level == "low_risk"
    assert result.decision == "allow"
    assert "Check" not in caplog.text
