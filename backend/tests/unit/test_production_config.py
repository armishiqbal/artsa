"""Production configuration must reject deployment-grade insecure defaults."""

import pytest
from pydantic import ValidationError

from src.core.config import Settings


def _production_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "a" * 48)
    monkeypatch.setenv("ARTSA_API_KEY", "b" * 48)
    monkeypatch.setenv("ARTSA_CORS_ORIGINS", "https://console.example.com")
    monkeypatch.setenv("USE_SQLITE", "false")
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+asyncpg://artsa:database-password-123@postgres/artsa"
    )
    monkeypatch.setenv("REDIS_URL", "redis://:redis-password-123@redis:6379/0")


def test_production_rejects_default_database_password(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://artsa:postgrespassword@postgres/artsa")

    with pytest.raises(ValidationError, match="DATABASE_URL"):
        Settings()


def test_production_rejects_unauthenticated_redis(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)
    monkeypatch.setenv("REDIS_URL", "redis://redis:6379/0")

    with pytest.raises(ValidationError, match="REDIS_URL"):
        Settings()


def test_production_accepts_strong_datastore_credentials(monkeypatch: pytest.MonkeyPatch):
    _production_env(monkeypatch)

    settings = Settings()

    assert settings.USE_SQLITE is False
