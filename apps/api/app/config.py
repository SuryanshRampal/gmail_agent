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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
