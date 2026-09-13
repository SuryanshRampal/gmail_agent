"""Typed LangGraph workflow for Gmail summarization."""

from __future__ import annotations

import re
from typing import Literal, TypedDict

import httpx
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field, ValidationError

from app.config import get_settings


class AgentState(TypedDict, total=False):
    user_id: str
    message_id: str
    cleaned_content: str
    summary: str
    error: str


class SummaryResult(BaseModel):
    summary: str = Field(min_length=1, max_length=12000)


def clean_content(content: str) -> str:
    text = re.sub(r"<style[^>]*>.*?</style>|<script[^>]*>.*?</script>", " ", content, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[: get_settings().max_summary_input_chars]


def load_authenticated_user(state: AgentState) -> AgentState:
    return {} if state.get("user_id") else {"error": "AUTHENTICATION_ERROR"}


def fetch_requested_message(state: AgentState) -> AgentState:
    # The authenticated Next.js Gmail service performs the actual Gmail fetch.
    # This graph boundary receives no OAuth credentials or database access.
    if not state.get("message_id") or not state.get("cleaned_content"):
        return {"error": "EMAIL_CONTENT_UNAVAILABLE"}
    return {}


def clean_and_bound_content(state: AgentState) -> AgentState:
    cleaned = clean_content(state.get("cleaned_content", ""))
    return {"cleaned_content": cleaned} if cleaned else {"error": "EMAIL_CONTENT_UNAVAILABLE"}


async def generate_summary(state: AgentState) -> AgentState:
    settings = get_settings()
    if not settings.openrouter_api_key:
        return {"error": "SUMMARY_PROVIDER_NOT_CONFIGURED"}
    prompt = (
        "Summarize this email factually and concisely. Prioritize the main point, "
        "important information, action items, deadlines, decisions, and open "
        "questions. Do not invent details. Preserve source hyperlinks as Markdown "
        "links. Return only the summary text.\n\nEmail:\n" + state["cleaned_content"]
    )
    try:
        async with httpx.AsyncClient(timeout=settings.openrouter_timeout_seconds) as client:
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
        response.raise_for_status()
        text = response.json()["choices"][0]["message"]["content"].strip()
        return {"summary": SummaryResult(summary=text).summary}
    except (httpx.HTTPError, KeyError, IndexError, TypeError, AttributeError, ValidationError):
        return {"error": "SUMMARY_PROVIDER_UNAVAILABLE"}


def validate_result(state: AgentState) -> AgentState:
    if state.get("error"):
        return {}
    try:
        return {"summary": SummaryResult(summary=state.get("summary", "")).summary}
    except ValidationError:
        return {"error": "SUMMARY_RESULT_INVALID"}


def route(state: AgentState, next_node: str) -> Literal["next", "end"]:
    return "end" if state.get("error") else "next"


builder = StateGraph(AgentState)
builder.add_node("load_authenticated_user", load_authenticated_user)
builder.add_node("fetch_requested_message", fetch_requested_message)
builder.add_node("clean_and_bound_content", clean_and_bound_content)
builder.add_node("generate_summary", generate_summary)
builder.add_node("validate_result", validate_result)
builder.add_edge(START, "load_authenticated_user")
builder.add_conditional_edges("load_authenticated_user", lambda s: "end" if s.get("error") else "next", {"next": "fetch_requested_message", "end": END})
builder.add_conditional_edges("fetch_requested_message", lambda s: "end" if s.get("error") else "next", {"next": "clean_and_bound_content", "end": END})
builder.add_conditional_edges("clean_and_bound_content", lambda s: "end" if s.get("error") else "next", {"next": "generate_summary", "end": END})
builder.add_conditional_edges("generate_summary", lambda s: "end" if s.get("error") else "next", {"next": "validate_result", "end": END})
builder.add_edge("validate_result", END)
summary_graph = builder.compile()
