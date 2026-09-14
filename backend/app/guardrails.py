"""Pre-access sensitivity guardrail for limited Gmail message envelopes."""

from __future__ import annotations

import logging
import re
from functools import lru_cache
from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field, ValidationError

from app.config import get_settings

logger = logging.getLogger(__name__)

Category = Literal["financial", "medical", "personal", "uncertain"]
Decision = Literal["allow", "permission_required", "blocked"]


class MessageEnvelope(BaseModel):
    message_id: str = Field(min_length=1, max_length=512)
    sender: str = Field(default="", max_length=1000)
    subject: str = Field(default="", max_length=2000)
    snippet: str = Field(default="", max_length=6000)
    received_at: str = Field(default="", max_length=200)


class SensitivityResult(BaseModel):
    categories: list[Category] = Field(default_factory=list)
    confidence_band: Literal["low", "medium", "high"] = "low"
    decision: Decision = "permission_required"
    warning: str = "Unable to assess this message safely. Permission is required before opening it."


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


def _classify_text(envelope: MessageEnvelope) -> SensitivityResult:
    text = f"From: {envelope.sender}\nSubject: {envelope.subject}\nSnippet: {envelope.snippet}"[:6000]
    # Keep obvious marketing mail usable while the local model is warming up or unavailable.
    # This is intentionally narrow and never overrides a high-risk signal.
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
        return SensitivityResult(categories=categories, confidence_band="high", decision="permission_required", warning="This message may contain personal, financial, medical, booking, or security information. Review permission before opening its contents.")
    if promotional or recognized_sender:
        return SensitivityResult(categories=[], confidence_band="high", decision="allow", warning="")
    labels = {
        "financial": "financial or banking information",
        "medical": "medical or health information",
        "personal": "personal identity or private information",
        "uncertain": "sensitive information that needs user review",
    }
    output = _classifier()(text, candidate_labels=list(labels.values()), multi_label=True)
    scores = dict(zip(output["labels"], output["scores"], strict=False))
    selected = [category for category, label in labels.items() if scores.get(label, 0) >= 0.55]
    top_score = max(scores.values(), default=0.0)
    if top_score < 0.4:
        return SensitivityResult(categories=[], confidence_band="high", decision="allow", warning="")
    confidence_band = "high" if top_score >= 0.75 else "medium" if top_score >= 0.55 else "low"
    if "uncertain" in selected or confidence_band == "low":
        selected = ["uncertain"]
    category_text = ", ".join(selected)
    return SensitivityResult(
        categories=selected,
        confidence_band=confidence_band,
        decision="permission_required",
        warning=f"This message may contain {category_text} information. Review permission before opening its contents.",
    )


def validate_input(state: GuardrailState) -> GuardrailState:
    if not state.get("user_id") or not state.get("envelope"):
        return {"error": "GUARDRAIL_INPUT_INVALID"}
    return {}


def classify(state: GuardrailState) -> GuardrailState:
    try:
        return {"result": _classify_text(state["envelope"])}
    except Exception as error:  # Model/runtime failures must fail closed.
        logger.warning("Sensitivity classifier unavailable: type=%s", type(error).__name__)
        return {"result": SensitivityResult()}


def validate_result(state: GuardrailState) -> GuardrailState:
    try:
        result = SensitivityResult.model_validate(state.get("result"))
        if result.decision == "allow" and result.categories:
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
