"""Pre-access sensitivity guardrail for limited Gmail message envelopes."""

from __future__ import annotations

import logging
import re
from functools import lru_cache
from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field, ValidationError

from app.config import get_settings
from app.phishing import PhishingAssessment, assess_envelope

logger = logging.getLogger(__name__)

Category = Literal["financial", "medical", "personal", "uncertain"]
Decision = Literal["allow", "permission_required", "blocked"]


class MessageEnvelope(BaseModel):
    message_id: str = Field(min_length=1, max_length=512)
    sender: str = Field(default="", max_length=1000)
    subject: str = Field(default="", max_length=2000)
    snippet: str = Field(default="", max_length=6000)
    received_at: str = Field(default="", max_length=200)
    reply_to: str = Field(default="", max_length=1000)
    return_path: str = Field(default="", max_length=1000)
    authentication_results: str = Field(default="", max_length=4000)
    labels: list[str] = Field(default_factory=list, max_length=50)


class SensitivityResult(BaseModel):
    categories: list[Category] = Field(default_factory=list)
    confidence_band: Literal["low", "medium", "high"] = "low"
    decision: Decision = "permission_required"
    warning: str = "This message could contain sensitive information, but we couldn't determine its category safely. Permission is required before opening its contents."
    phishing: PhishingAssessment = Field(default_factory=PhishingAssessment)


class GuardrailState(TypedDict, total=False):
    user_id: str
    envelope: MessageEnvelope
    result: SensitivityResult
    error: str


@lru_cache(maxsize=1)
def _classifier():
    from transformers import pipeline

    settings = get_settings()
    return pipeline(
        "zero-shot-classification",
        model=settings.sensitivity_model,
        local_files_only=settings.sensitivity_model_local_only,
    )


def _allow(phishing: PhishingAssessment) -> SensitivityResult:
    return SensitivityResult(categories=[], confidence_band="high", decision="allow", warning="", phishing=phishing)


def _permission_required(categories: list[Category], warning: str, phishing: PhishingAssessment) -> SensitivityResult:
    return SensitivityResult(categories=categories, confidence_band="high", decision="permission_required", warning=warning, phishing=phishing)


def _ambiguous_envelope(text: str) -> bool:
    """Reserve optional inference for bounded envelopes with a possible risk signal."""
    return bool(re.search(
        r"\b(account|security|verification|identity|personal|private|document|record|statement|request|clinic|doctor|health)\b",
        text,
        re.I,
    ))


def _deterministic_preflight(envelope: MessageEnvelope) -> SensitivityResult | None:
    text = f"From: {envelope.sender}\nSubject: {envelope.subject}\nSnippet: {envelope.snippet}"[:6000]
    phishing = assess_envelope(sender=envelope.sender, reply_to=envelope.reply_to, authentication_results=envelope.authentication_results, subject=envelope.subject, snippet=envelope.snippet)
    if phishing.risk_level != "low_risk":
        return _permission_required(
            [],
            "This message may contain phishing indicators. Review the security warning before opening its contents.",
            phishing,
        )
    # Keep obvious marketing mail usable while the local model is warming up or unavailable.
    # This is intentionally narrow and never overrides a phishing or sensitive signal.
    promotional = re.search(r"\b(sale|offer|discount|coupon|cashback|deal|newsletter|marketing|sponsored|unsubscribe|limited time|breaking news|daily briefing|weekly digest|recommendations?|new releases?|save up to|flight deals?|travel deals?|booking deals?)\b", text, re.I)
    recognized_sender = re.search(r"\b(bloomberg|mcdonald(?:'|’)s|linkedin|facebook|instagram|twitter|x\.com|snapchat|reddit|youtube|pvr|air india|airindia|indigo|spicejet|vistara|emirates|etihad|qatar airways|lufthansa|flydubai|booking\.com|makemytrip|cleartrip|traveloka|expedia|agoda|airbnb|wego|trip|airline|hotel|travel|retail|restaurant|store|newsletters?|marketing|promo|offers?)\b", envelope.sender, re.I)
    financial_hint = re.search(r"\b(bank|account number|credit card|debit card|routing number|statement|transfer|payment confirmation|tax)\b", text, re.I)
    medical_hint = re.search(r"\b(diagnosis|prescription|medical record|patient|lab result|health insurance|appointment)\b", text, re.I)
    personal_hint = re.search(r"\b(password|one[- ]time password|otp|social security|passport|national id|private message|direct message|booking confirmation|reservation|itinerary|boarding pass|booking reference|pnr|ticket|seat|departure|arrival|check[- ]in|hotel reservation|invoice|receipt|fare|pickup|drop[- ]off|ride details|payment received)\b", text, re.I)
    sensitive_hint = financial_hint or medical_hint or personal_hint
    # Sender category alone is not sensitive. Personal activity, security events,
    # and booking/transaction language are the meaningful escalation signals.
    if sensitive_hint:
        categories = (["financial"] if financial_hint else []) + (["medical"] if medical_hint else []) + (["personal"] if personal_hint else [])
        return _permission_required(categories, "This message may contain personal, financial, medical, booking, or security information. Review permission before opening its contents.", phishing)
    if promotional or recognized_sender:
        return _allow(phishing)
    if not _ambiguous_envelope(text):
        return _allow(phishing)
    return None


def _classify_ambiguous_envelope(envelope: MessageEnvelope) -> SensitivityResult:
    text = f"From: {envelope.sender}\nSubject: {envelope.subject}\nSnippet: {envelope.snippet}"[:6000]
    phishing = assess_envelope(sender=envelope.sender, reply_to=envelope.reply_to, authentication_results=envelope.authentication_results, subject=envelope.subject, snippet=envelope.snippet)
    labels = {
        "financial": "financial or banking information",
        "medical": "medical or health information",
        "personal": "personal identity or private information",
        "uncertain": "sensitive information that needs user review",
    }
    output = _classifier()(text, candidate_labels=[*labels.values(), "phishing or social engineering language"], multi_label=True)
    scores = dict(zip(output["labels"], output["scores"], strict=False))
    model_phishing_score = scores.get("phishing or social engineering language", 0.0)
    other_model_scores = [score for label, score in scores.items() if label != "phishing or social engineering language"]
    phishing_margin = model_phishing_score - max(other_model_scores, default=0.0)
    if phishing.risk_level == "low_risk" and model_phishing_score >= 0.9 and phishing_margin >= 0.15:
        phishing = PhishingAssessment(risk_level="needs_attention", confidence_band="high", reasons=["The message language resembles a social-engineering or impersonation attempt."], link_count=phishing.link_count, bounded=True)
    sensitivity_scores = {label: scores.get(label, 0.0) for label in labels.values()}
    selected = [category for category, label in labels.items() if sensitivity_scores[label] >= 0.72]
    ordered_sensitivity_scores = sorted(sensitivity_scores.values(), reverse=True)
    top_score = ordered_sensitivity_scores[0] if ordered_sensitivity_scores else 0.0
    sensitivity_margin = top_score - (ordered_sensitivity_scores[1] if len(ordered_sensitivity_scores) > 1 else 0.0)
    if len(selected) == 1 and sensitivity_margin < 0.12:
        selected = []
    if top_score < 0.72 or not selected:
        if phishing.risk_level == "low_risk":
            return _allow(phishing)
        if phishing.risk_level == "needs_attention":
            return SensitivityResult(categories=[], confidence_band=phishing.confidence_band, decision="allow", warning="", phishing=phishing)
        return SensitivityResult(categories=[], confidence_band=phishing.confidence_band, decision="permission_required", warning="This message may contain phishing indicators. Review the security warning before opening its contents.", phishing=phishing)
    confidence_band = "high" if top_score >= 0.75 else "medium" if top_score >= 0.55 else "low"
    if "uncertain" in selected or confidence_band == "low":
        selected = ["uncertain"]
    category_text = ", ".join(selected)
    decision = "permission_required" if phishing.risk_level != "low_risk" else "permission_required"
    warning = f"This message may contain {category_text} information. Review permission before opening its contents."
    if phishing.risk_level != "low_risk": warning += " It also contains possible phishing indicators."
    return SensitivityResult(
        categories=selected,
        confidence_band=confidence_band,
        decision=decision,
        warning=warning,
        phishing=phishing,
    )


def _classify_text(envelope: MessageEnvelope) -> SensitivityResult:
    deterministic = _deterministic_preflight(envelope)
    if deterministic is not None:
        return deterministic
    return _classify_ambiguous_envelope(envelope)


def validate_input(state: GuardrailState) -> GuardrailState:
    if not state.get("user_id") or not state.get("envelope"):
        return {"error": "GUARDRAIL_INPUT_INVALID"}
    return {}


def classify(state: GuardrailState) -> GuardrailState:
    try:
        return {"result": _classify_text(state["envelope"])}
    except Exception as error:  # Model/runtime failures must fail closed.
        logger.warning("Sensitivity classifier unavailable; using protected fallback: type=%s", type(error).__name__)
        return {"result": SensitivityResult()}


def validate_result(state: GuardrailState) -> GuardrailState:
    try:
        result = SensitivityResult.model_validate(state.get("result"))
        if result.decision == "allow" and (result.categories or result.phishing.risk_level in {"high_risk", "unable_to_verify"}):
            return {"result": SensitivityResult()}
        return {"result": result}
    except ValidationError:
        return {"result": SensitivityResult()}


builder = StateGraph(GuardrailState)
builder.add_node("validate_input", validate_input)
builder.add_node("classify", classify)
builder.add_node("validate_result", validate_result)
builder.add_edge(START, "validate_input")
builder.add_conditional_edges("validate_input", lambda state: "end" if state.get("error") else "next", {"next": "classify", "end": END})
builder.add_edge("classify", "validate_result")
builder.add_edge("validate_result", END)
guardrail_graph = builder.compile()


async def preflight(user_id: str, envelope: MessageEnvelope) -> SensitivityResult:
    import asyncio

    state = await asyncio.to_thread(guardrail_graph.invoke, {"user_id": user_id, "envelope": envelope})
    return SensitivityResult.model_validate(state.get("result") or SensitivityResult())
