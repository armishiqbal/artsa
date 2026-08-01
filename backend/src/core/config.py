"""ARTSA Core Settings & Configuration (Pydantic Settings)."""

import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Platform global settings loaded from environment variables or .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    ENVIRONMENT: str = "development"
    ARTSA_LOG_LEVEL: str = "INFO"
    SECRET_KEY: str = "supersecret-artsa-jwt-encryption-key-2026"

    # Databases
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/artsa_db"
    SYNC_DATABASE_URL: str = "postgresql://postgres:postgrespassword@localhost:5432/artsa_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Managed Cloud Credentials
    SUPABASE_URL: Optional[str] = "https://kbzxumgojcqgecmcmyou.supabase.co"
    SUPABASE_PUBLISHABLE_KEY: Optional[str] = "sb_publishable_yQjcEAk5TIcMgnvmEQ5ifA_X24B5QhB"
    PINECONE_API_KEY: Optional[str] = "pcsk_DnAZB_6jxqqSNTm9Q8JsLtH7z58jr3uJW9ge5LCS94nNhhLaqm6T7jR3L6Sa76GFJGEhR"
    CHROMA_PERSIST_DIR: str = "./data/chroma"

    # LLM Providers & Models
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    MISTRAL_API_KEY: Optional[str] = None

    # Default Target Model
    DEFAULT_MODEL: str = "gpt-5.6-terra"
    DEFAULT_PROVIDER: str = "openai"

    # EDS Engine Latency Thresholds
    EDS_LATENCY_THRESHOLD_MS: float = 50.0


settings = Settings()
