"""Partner API key registry + create/revoke auth resolution."""

from __future__ import annotations

import pytest

from src.core.rbac import Role, resolve_role
from src.services import partner_key_registry


@pytest.fixture(autouse=True)
def _clear_registry():
    partner_key_registry.clear()
    yield
    partner_key_registry.clear()


def test_partner_key_resolve_after_upsert():
    raw = "artsa_live_abc123deadbeef"
    h = partner_key_registry.hash_api_key(raw)
    partner_key_registry.upsert(
        {"key_hash": h, "id": "k1", "name": "demo", "role": "analyst", "enabled": True}
    )
    assert partner_key_registry.resolve(raw) == Role.ANALYST
    assert partner_key_registry.resolve("wrong-key") is None


def test_resolve_role_uses_partner_registry(monkeypatch):
    monkeypatch.setattr("src.core.config.settings.ARTSA_API_KEY", "platform-admin-key")
    monkeypatch.setattr("src.core.config.settings.ARTSA_ANALYST_API_KEY", None)
    monkeypatch.setattr("src.core.config.settings.ARTSA_REDTEAM_API_KEY", None)
    monkeypatch.setattr("src.core.config.settings.ARTSA_READONLY_API_KEY", None)

    raw = "artsa_live_partner_demo_001"
    partner_key_registry.upsert(
        {
            "key_hash": partner_key_registry.hash_api_key(raw),
            "id": "k2",
            "name": "acme",
            "role": "analyst",
            "enabled": True,
        }
    )
    assert resolve_role(raw) == Role.ANALYST
    assert resolve_role("platform-admin-key") == Role.ADMIN
    assert resolve_role("forged") is None


def test_any_static_includes_partner_keys(monkeypatch):
    from src.core.auth_credentials import any_static_api_key_configured

    monkeypatch.setattr("src.core.config.settings.ARTSA_API_KEY", None)
    monkeypatch.setattr("src.core.config.settings.ARTSA_ANALYST_API_KEY", None)
    monkeypatch.setattr("src.core.config.settings.ARTSA_REDTEAM_API_KEY", None)
    monkeypatch.setattr("src.core.config.settings.ARTSA_READONLY_API_KEY", None)

    assert any_static_api_key_configured() is False
    partner_key_registry.upsert(
        {
            "key_hash": partner_key_registry.hash_api_key("artsa_live_x"),
            "id": "k3",
            "name": "x",
            "role": "analyst",
            "enabled": True,
        }
    )
    assert any_static_api_key_configured() is True
