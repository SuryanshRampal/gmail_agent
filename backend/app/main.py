from fastapi import FastAPI
from fastapi import Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.agent import summary_graph
from app.outbound import create_draft
from app.guardrails import MessageEnvelope, preflight
from app.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


class SummaryRequest(BaseModel):
    message_id: str = Field(min_length=1, max_length=512)
    content: str = Field(min_length=1, max_length=100000)


@app.post("/agent/summarize")
async def summarize(
    request: SummaryRequest,
    x_agent_key: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
) -> dict[str, str]:
    if not settings.agent_service_key or x_agent_key != settings.agent_service_key:
        raise HTTPException(status_code=401, detail="Unauthorized agent request")
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing authenticated user")
    result = await summary_graph.ainvoke({"user_id": x_user_id, "message_id": request.message_id, "cleaned_content": request.content})
    if result.get("error"):
        error = result["error"]
        status = 503 if error.startswith("SUMMARY_PROVIDER") else 422
        raise HTTPException(status_code=status, detail=error)
    return {"summary": result["summary"]}


class DraftRequest(BaseModel):
    request: str = Field(min_length=3, max_length=20000)
    context: str = Field(default="", max_length=30000)


class PreflightRequest(MessageEnvelope):
    pass


@app.post("/agent/preflight")
async def preflight_message(
    request: PreflightRequest,
    x_agent_key: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
) -> dict[str, object]:
    if not settings.agent_service_key or x_agent_key != settings.agent_service_key:
        raise HTTPException(status_code=401, detail="Unauthorized agent request")
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing authenticated user")
    result = await preflight(x_user_id, request)
    return {"result": result.model_dump()}


@app.post("/agent/draft")
async def draft_email(
    request: DraftRequest,
    x_agent_key: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
) -> dict[str, object]:
    if not settings.agent_service_key or x_agent_key != settings.agent_service_key:
        raise HTTPException(status_code=401, detail="Unauthorized agent request")
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing authenticated user")
    result = await create_draft(request.request, request.context)
    if isinstance(result, str):
        return {"clarification": result}
    return {"draft": result.model_dump()}
