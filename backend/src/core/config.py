"""ARTSA Core Settings — single source of truth for all environment variables."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve repo root (.env lives here) and backend dir
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_REPO_ROOT = _BACKEND_DIR.parent

_ENV_FILES = (
    str(_REPO_ROOT / ".env"),
    str(_BACKEND_DIR / ".env"),
    str(_REPO_ROOT / ".env.local"),
)


class Settings(BaseSettings):
    """Platform settings loaded from environment / .env files."""

    model_config = SettingsConfigDict(
        env_file=_ENV_FILES,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def _reject_insecure_defaults(self) -> Settings:
        """Fail fast if production runs with the default secret key."""
        if self.ENVIRONMENT == "production" and self.SECRET_KEY == "change-me-in-production":
            raise ValueError(
                "SECRET_KEY must be set to a strong random value in production. "
                'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(64))"'
            )
        return self

    # ── Core ──────────────────────────────────────────────────────────────
    ENVIRONMENT: str = "development"
    ARTSA_LOG_LEVEL: str = "INFO"
    SECRET_KEY: str = Field(default="change-me-in-production", min_length=16)
    ARTSA_API_KEY: Optional[str] = None
    ARTSA_TENANT_ID: str = "default_org"
    ARTSA_DATA_DIR: str = "./data"

    # ── Database ────────────────────────────────────────────────────────
    USE_SQLITE: bool = True
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/artsa.db"
    SYNC_DATABASE_URL: str = "sqlite:///./data/artsa.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    USE_CELERY: bool = False
    USE_REDIS_RATE_LIMIT: bool = True
    BENCHMARK_CACHE_TTL_SEC: int = 300
    ARTSA_REQUIRE_AUTH: bool = False
    ARTSA_ANALYST_API_KEY: Optional[str] = None
    ARTSA_REDTEAM_API_KEY: Optional[str] = None
    ARTSA_READONLY_API_KEY: Optional[str] = None
    USE_CHROMA_RAG: bool = False
    USE_PINECONE_RAG: bool = False
    PINECONE_INDEX_NAME: str = "artsa-policy-kb"
    PINECONE_NAMESPACE: str = "policy"
    ARTSA_OIDC_ENABLED: bool = False
    ARTSA_OIDC_ISSUER: Optional[str] = None
    ARTSA_OIDC_AUDIENCE: Optional[str] = None
    ARTSA_OIDC_JWKS_URL: Optional[str] = None
    ARTSA_OIDC_ROLE_CLAIM: str = "groups"
    ARTSA_OIDC_ADMIN_GROUPS: str = "artsa-admin"
    ARTSA_OIDC_ANALYST_GROUPS: str = "artsa-analyst"
    ARTSA_OIDC_REDTEAM_GROUPS: str = "artsa-redteam"
    ARTSA_OIDC_READONLY_GROUPS: str = "artsa-readonly"
    ARTSA_OIDC_DEFAULT_ROLE: Optional[str] = None
    ARTSA_CORS_ORIGINS: str = "*"
    ARTSA_RATE_LIMIT_RPM: int = 600
    WARM_BENCHMARK_ON_START: bool = False
    SEED_ATTACK_LIBRARY_ON_START: bool = False
    SCHEDULED_ABLATION_INTERVAL_SEC: int = 0  # 0=disabled; e.g. 3600 for hourly refresh

    # ── Supabase (optional managed Postgres) ────────────────────────────
    SUPABASE_URL: Optional[str] = None
    SUPABASE_PUBLISHABLE_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None

    # ── Vector stores ───────────────────────────────────────────────────
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_ENVIRONMENT: Optional[str] = None
    CHROMA_PERSIST_DIR: str = "./data/chroma"

    # ── LLM providers (cloud) ───────────────────────────────────────────
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    MISTRAL_API_KEY: Optional[str] = None
    DEEPSEEK_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    TOGETHER_API_KEY: Optional[str] = None
    FIREWORKS_API_KEY: Optional[str] = None
    HUGGINGFACE_API_KEY: Optional[str] = None
    HF_TOKEN: Optional[str] = None
    COHERE_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None

    # ── Local / self-hosted LLM endpoints ───────────────────────────────
    OLLAMA_API_KEY: Optional[str] = None
    OLLAMA_BASE_URL: Optional[str] = "http://localhost:11434/v1"
    VLLM_API_KEY: Optional[str] = None
    VLLM_BASE_URL: Optional[str] = "http://localhost:8000/v1"
    LMSTUDIO_API_KEY: Optional[str] = None
    LMSTUDIO_BASE_URL: Optional[str] = "http://localhost:1234/v1"
    JAN_API_KEY: Optional[str] = None
    JAN_BASE_URL: Optional[str] = "http://localhost:1337/v1"
    LOCAL_API_KEY: Optional[str] = None
    LOCAL_BASE_URL: Optional[str] = None

    # ── Guardrail / safety stacks ───────────────────────────────────────
    LAKERA_API_KEY: Optional[str] = None
    LAKERA_BASE_URL: Optional[str] = "https://api.lakera.ai/v2"
    AZURE_CONTENT_SAFETY_KEY: Optional[str] = None
    AZURE_CONTENT_SAFETY_ENDPOINT: Optional[str] = None
    NVIDIA_API_KEY: Optional[str] = None
    NEMO_GUARDRAILS_URL: Optional[str] = None

    # ── Defaults ────────────────────────────────────────────────────────
    ARTSA_DEFAULT_PROVIDER: str = "openai"
    ARTSA_DEFAULT_MODEL: str = "gpt-4o"
    DEFAULT_PROVIDER: str = "openai"
    DEFAULT_MODEL: str = "gpt-4o"

    # ── Performance SLOs ────────────────────────────────────────────────
    EDS_LATENCY_THRESHOLD_MS: float = 50.0

    # ── Detection / embeddings ──────────────────────────────────────────
    ARTSA_EMBEDDING_MODEL: str = "auto"  # auto | hash-1024 | text-embedding-3-large

    def resolve_embedding_model(self) -> str:
        """Pick embedding backend: hash in tests, OpenAI when configured, else hash."""
        if self.is_testing:
            return "hash-1024"
        if self.ARTSA_EMBEDDING_MODEL != "auto":
            return self.ARTSA_EMBEDDING_MODEL
        if self.is_key_configured("OPENAI_API_KEY"):
            return "text-embedding-3-large"
        return "hash-1024"

    @property
    def is_testing(self) -> bool:
        return self.ENVIRONMENT == "testing"

    @property
    def auth_required(self) -> bool:
        """Require X-API-Key on all non-public routes."""
        if self.ARTSA_REQUIRE_AUTH:
            return True
        return self.ENVIRONMENT == "production"

    @property
    def cors_origins(self) -> list[str]:
        raw = (self.ARTSA_CORS_ORIGINS or "*").strip()
        if raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def effective_database_url(self) -> str:
        if self.USE_SQLITE:
            return self.DATABASE_URL if "sqlite" in self.DATABASE_URL else "sqlite+aiosqlite:///./data/artsa.db"
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    def provider_key(self, provider: str) -> Optional[str]:
        """Resolve API key for a named provider."""
        mapping = {
            "openai": self.OPENAI_API_KEY,
            "anthropic": self.ANTHROPIC_API_KEY,
            "groq": self.GROQ_API_KEY,
            "mistral": self.MISTRAL_API_KEY,
            "deepseek": self.DEEPSEEK_API_KEY,
            "openrouter": self.OPENROUTER_API_KEY,
            "together": self.TOGETHER_API_KEY,
            "fireworks": self.FIREWORKS_API_KEY,
            "huggingface": self.HUGGINGFACE_API_KEY or self.HF_TOKEN,
            "ollama": self.OLLAMA_API_KEY,
            "vllm": self.VLLM_API_KEY,
            "lmstudio": self.LMSTUDIO_API_KEY,
            "jan": self.JAN_API_KEY,
            "local": self.LOCAL_API_KEY,
            "cohere": self.COHERE_API_KEY,
            "google": self.GOOGLE_API_KEY,
        }
        return mapping.get(provider.lower())

    def is_key_configured(self, key_name: str) -> bool:
        val = getattr(self, key_name, None)
        if val is None:
            return False
        if isinstance(val, str) and val.strip() in ("", "mock-key", "mock-key-for-testing", "change-me-in-production"):
            return False
        return True


settings = Settings()
