"""Privacy-safe phishing signals for bounded Gmail message envelopes."""

from __future__ import annotations

import re
from urllib.parse import urlsplit
from typing import Literal

from pydantic import BaseModel, Field

PhishingRisk = Literal["low_risk", "needs_attention", "high_risk", "unable_to_verify"]
PhishingConfidence = Literal["low", "medium", "high"]


class PhishingAssessment(BaseModel):
    risk_level: PhishingRisk = "unable_to_verify"
    confidence_band: PhishingConfidence = "low"
    reasons: list[str] = Field(default_factory=list, max_length=8)
    link_count: int = Field(default=0, ge=0)
    bounded: bool = True


EMAIL_RE = re.compile(r"<\s*([^<>\s@]+@[^<>\s@]+)\s*>")
URL_RE = re.compile(r"https?://[^\s<>\"']+", re.I)
AUTH_FAILURE_RE = re.compile(r"(?:spf|dkim|dmarc)\s*[=:]\s*fail|authentication-results:[^\n]*(?:fail|softfail)", re.I)
URL_SHORTENER_DOMAINS = {"bit.ly", "t.co", "tinyurl.com", "goo.gl", "is.gd", "ow.ly", "rb.gy", "cutt.ly"}
SUSPICIOUS_TLDS = {".click", ".download", ".gq", ".icu", ".live", ".monster", ".top", ".work", ".zip"}


def _address(value: str) -> str:
    match = EMAIL_RE.search(value or "")
    return (match.group(1) if match else value or "").strip().lower()


def _domain(value: str) -> str:
    address = _address(value)
    return address.rsplit("@", 1)[-1].strip(".") if "@" in address else ""


def _urls(text: str) -> list[str]:
    return [match.rstrip(".,;:!?)]}") for match in URL_RE.findall(text or "")]


def assess_envelope(*, sender: str, reply_to: str = "", authentication_results: str = "", subject: str = "", snippet: str = "") -> PhishingAssessment:
    text = f"{subject}\n{snippet}"[:6000]
    sender_domain = _domain(sender)
    reply_domain = _domain(reply_to)
    reasons: list[str] = []
    strong_signals = 0
    medium_signals = 0

    if reply_domain and sender_domain and reply_domain != sender_domain:
        reasons.append("The reply address uses a different domain from the visible sender.")
        strong_signals += 1
    if AUTH_FAILURE_RE.search(authentication_results or ""):
        reasons.append("The available sender-authentication results include a failure.")
        strong_signals += 1
    if sender_domain.startswith("xn--") or ".xn--" in sender_domain:
        reasons.append("The sender domain uses an encoded internationalized domain name.")
        medium_signals += 1

    urls = _urls(text)
    for raw_url in urls:
        try:
            parsed = urlsplit(raw_url)
            host = (parsed.hostname or "").lower().rstrip(".")
            if not host or parsed.username or parsed.password:
                reasons.append("A link contains an unusual or hidden destination.")
                strong_signals += 1
                continue
            if host in URL_SHORTENER_DOMAINS:
                reasons.append("A link uses a URL-shortening service that hides its final destination.")
                medium_signals += 1
            if any(host.endswith(tld.replace(" ", "")) for tld in SUSPICIOUS_TLDS):
                reasons.append("A link uses a domain ending commonly associated with deceptive campaigns.")
                medium_signals += 1
            if re.search(r"(?:login|log-in|verify|validation|password|credential|payment|wallet|security-check)", f"{host}{parsed.path}".lower()):
                reasons.append("A link asks the recipient to sign in, verify an account, or make a payment.")
                medium_signals += 1
            if re.fullmatch(r"\d{1,3}(?:\.\d{1,3}){3}", host):
                reasons.append("A link points directly to an IP address instead of a named domain.")
                strong_signals += 1
        except ValueError:
            reasons.append("A link has an invalid or unexpected destination format.")
            strong_signals += 1

    impersonation = re.search(r"\b(verify your account|confirm your identity|unusual activity|suspended|security alert|urgent action|act now|last warning|claim your prize)\b", text, re.I)
    credential_request = re.search(r"\b(password|one[- ]time password|otp|verification code|login credentials|bank details|card details)\b", text, re.I)
    if impersonation:
        reasons.append("The message uses urgency or account-security language.")
        medium_signals += 1
    if credential_request:
        reasons.append("The message appears to request credentials or payment information.")
        strong_signals += 1

    # Deduplicate while keeping telemetry and UI explanations bounded.
    reasons = list(dict.fromkeys(reasons))[:8]
    if strong_signals >= 2 or (strong_signals >= 1 and medium_signals >= 1):
        risk: PhishingRisk = "high_risk"
        confidence: PhishingConfidence = "high"
    elif strong_signals or medium_signals >= 2:
        risk = "needs_attention"
        confidence = "medium"
    else:
        risk = "low_risk"
        confidence = "high"
    return PhishingAssessment(risk_level=risk, confidence_band=confidence, reasons=reasons, link_count=len(urls), bounded=True)
