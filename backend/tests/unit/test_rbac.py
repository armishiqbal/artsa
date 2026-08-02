"""RBAC permission tests."""

from src.core.rbac import Role, is_allowed, resolve_role, role_capabilities


def test_admin_has_full_access():
    assert is_allowed(Role.ADMIN, "POST", "/api/v1/campaigns/run")
    assert is_allowed(Role.ADMIN, "DELETE", "/api/v1/policies")


def test_readonly_get_only():
    assert is_allowed(Role.READONLY, "GET", "/api/v1/sessions")
    assert not is_allowed(Role.READONLY, "POST", "/api/v1/ingest")


def test_redteam_campaign_access():
    assert is_allowed(Role.REDTEAM, "POST", "/api/v1/campaigns/run")
    assert not is_allowed(Role.REDTEAM, "PUT", "/api/v1/policies")


def test_resolve_admin_key(monkeypatch):
    from src.core.config import settings

    monkeypatch.setattr(settings, "ARTSA_API_KEY", "admin-secret-key-12345")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    assert resolve_role("admin-secret-key-12345") == Role.ADMIN
    assert resolve_role("wrong") is None


def test_role_capabilities_readonly():
    caps = role_capabilities(Role.READONLY)
    assert caps["read_only"] is True
    assert caps["can_run_campaigns"] is False
    assert caps["can_run_ablation"] is False
