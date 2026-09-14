from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Gmail Agent API"
    environment: str = "development"
    allowed_origins: list[str] = ["http://localhost:3000"]
    supabase_url: str | None = None
    supabase_publishable_key: str | None = None
    # Server-only: never expose this value to the Next.js client.
    supabase_service_role_key: str | None = None
    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "openai/gpt-4o-mini"
    openrouter_timeout_seconds: float = 30.0
    max_summary_input_chars: int = 30000
    agent_service_key: str | None = None
    sensitivity_model: str = "valhalla/distilbart-mnli-12-1"
    sensitivity_model_local_only: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
