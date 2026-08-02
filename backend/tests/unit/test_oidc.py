"""OIDC claim-to-role mapping tests."""

from src.core.oidc import role_from_claims
from src.core.rbac import Role


def test_role_from_admin_group():
    claims = {"groups": ["artsa-admin", "other"]}
    assert role_from_claims(claims) == Role.ADMIN


def test_role_from_analyst_group():
    claims = {"groups": ["artsa-analyst"]}
    assert role_from_claims(claims) == Role.ANALYST


def test_role_from_redteam_group():
    claims = {"groups": ["artsa-redteam"]}
    assert role_from_claims(claims) == Role.REDTEAM


def test_role_from_readonly_group():
    claims = {"groups": ["artsa-readonly"]}
    assert role_from_claims(claims) == Role.READONLY


def test_role_default_when_configured(monkeypatch):
    from src.core.config import settings

    monkeypatch.setattr(settings, "ARTSA_OIDC_DEFAULT_ROLE", "readonly")
    assert role_from_claims({"sub": "user-1"}) == Role.READONLY
