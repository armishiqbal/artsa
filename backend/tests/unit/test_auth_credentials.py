"""Unified credential resolution tests."""

from src.core.auth_credentials import extract_bearer_token, resolve_credentials
from src.core.rbac import Role


def test_extract_bearer_token():
    assert extract_bearer_token("Bearer abc.def.ghi") == "abc.def.ghi"
    assert extract_bearer_token("Basic xyz") is None
    assert extract_bearer_token(None) is None


def test_resolve_api_key_admin(monkeypatch):
    from src.core.config import settings

    monkeypatch.setattr(settings, "ARTSA_API_KEY", "admin-key-12345")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ARTSA_OIDC_ENABLED", False)

    assert resolve_credentials("admin-key-12345") == Role.ADMIN


def test_resolve_dev_default_without_keys(monkeypatch):
    from src.core.config import settings

    monkeypatch.setattr(settings, "ARTSA_API_KEY", None)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ARTSA_OIDC_ENABLED", False)
    monkeypatch.setattr(settings, "ARTSA_REQUIRE_AUTH", False)

    assert resolve_credentials(None) == Role.ADMIN
