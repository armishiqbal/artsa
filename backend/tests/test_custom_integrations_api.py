"""Tests for the custom-integration configuration API.

Covers CRUD with masked secrets, duplicate-slug 409, PATCH secret merge
semantics (preserve / rotate / delete), template validation, the schema
endpoint, and the Test action against a mocked HTTP client.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from tests.conftest import unwrap_response


@pytest.fixture
def integrations_api(monkeypatch, tmp_path):
    """Isolated DB + clean registry, ready for TestClient requests."""
    db = tmp_path / "test_integrations.db"
    monkeypatch.setattr("src.core.config.settings.DATABASE_URL", f"sqlite+aiosqlite:///{db}")
    monkeypatch.setattr("src.core.config.settings.SYNC_DATABASE_URL", f"sqlite:///{db}")
    monkeypatch.setattr("src.data.db._engine", None)
    monkeypatch.setattr("src.data.db._session_factory", None)

    from src.data.orm import Base

    sync_engine = create_engine(f"sqlite:///{db}")
    Base.metadata.create_all(sync_engine)
    sync_engine.dispose()

    from src.api.main import create_app
    from src.services.custom_integration_registry import custom_integration_registry

    custom_integration_registry.load([])
    return TestClient(create_app())


def _connector(**overrides) -> dict:
    payload = {
        "name": "my-siem",
        "description": "Custom SIEM sink",
        "method": "POST",
        "target_url": "https://sink.example.com/ingest",
        "auth_type": "bearer",
        "headers": {"X-Tenant": "acme"},
        "payload_template": None,
        "event_types": ["alert", "tool_call"],
        "risk_threshold": 0.0,
        "enabled": True,
        "retries": 3,
        "timeout": 10.0,
        "secrets": {"token": "s3cret-token-123456"},
        **overrides,
    }
    return payload


def _add(client: TestClient, **overrides):
    return client.post("/api/v1/integrations", json=_connector(**overrides))


# ─────────────────────────────────────────────────────────────────────────────
# Schema
# ─────────────────────────────────────────────────────────────────────────────


def test_schema_advertises_types(integrations_api):
    res = integrations_api.get("/api/v1/integrations/schema")
    assert res.status_code == 200
    schema = unwrap_response(res)
    assert schema["event_types"] == ["alert", "tool_call", "proxy_call", "session_action"]
    assert set(schema["methods"]) == {"POST", "PUT", "PATCH"}
    auth = {a["type"]: a for a in schema["auth_types"]}
    assert set(auth) == {"none", "bearer", "basic", "api_key"}
    assert auth["bearer"]["secrets"] == ["token"]
    assert auth["basic"]["secrets"] == ["username", "password"]
    assert "alert" in schema["template_fields"]
    assert "{{secret:name}}" in schema["placeholder_syntax"]["secret"]


# ─────────────────────────────────────────────────────────────────────────────
# Create + list + masked secrets
# ─────────────────────────────────────────────────────────────────────────────


def test_create_connector_secrets_masked(integrations_api):
    res = _add(integrations_api)
    assert res.status_code == 201
    body = unwrap_response(res)["integration"]
    assert body["name"] == "my-siem"
    assert body["target_url"] == "https://sink.example.com/ingest"
    assert body["event_types"] == ["alert", "tool_call"]
    assert body["has_secrets"] is True
    assert body["secrets_masked"] == {"token": "s3cr...3456"}
    assert "secrets" not in body  # raw secrets never echoed


def test_duplicate_slug_409(integrations_api):
    assert _add(integrations_api, name="My SIEM").status_code == 201
    res = _add(integrations_api, name="my-siem")  # slugifies to the same name
    assert res.status_code == 409


def test_create_populates_registry_with_decrypted_secret(integrations_api):
    """The in-memory registry (worker path) must see the plaintext secret —
    a regression for double-decryption: store decrypts, then registry.load
    must not decrypt a second time (that blanked every bearer token)."""
    from src.services.custom_integration_registry import custom_integration_registry

    _add(integrations_api, secrets={"token": "s3cret-token-123456"})
    conn = custom_integration_registry.get("my-siem")
    assert conn is not None
    assert conn.secrets["token"] == "s3cret-token-123456"


def test_list_masked_and_total(integrations_api):
    _add(integrations_api)
    listed = unwrap_response(integrations_api.get("/api/v1/integrations"))
    assert listed["total"] == 1
    row = listed["integrations"][0]
    assert row["secrets_masked"] == {"token": "s3cr...3456"}
    assert "secrets" not in row


def test_get_one_masked(integrations_api):
    _add(integrations_api)
    res = integrations_api.get("/api/v1/integrations/my-siem")
    assert res.status_code == 200
    body = unwrap_response(res)["integration"]
    assert body["name"] == "my-siem"
    assert body["has_secrets"] is True
    assert "secrets" not in body


def test_get_unknown_404(integrations_api):
    assert integrations_api.get("/api/v1/integrations/ghost").status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Validation
# ─────────────────────────────────────────────────────────────────────────────


def test_invalid_payload_template_422(integrations_api):
    res = _add(integrations_api, payload_template="{ not valid json")
    assert res.status_code == 422


def test_unknown_auth_type_422(integrations_api):
    res = _add(integrations_api, auth_type="oauth2")
    assert res.status_code == 422


def test_missing_target_url_422(integrations_api):
    res = integrations_api.post(
        "/api/v1/integrations", json={"name": "no-url", "target_url": ""}
    )
    assert res.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# PATCH (partial update + secret merge)
# ─────────────────────────────────────────────────────────────────────────────


def test_patch_preserves_unmentioned_secrets(integrations_api):
    _add(integrations_api)
    res = integrations_api.patch(
        "/api/v1/integrations/my-siem",
        json={"target_url": "https://new.example.com/ingest", "event_types": ["alert"]},
    )
    assert res.status_code == 200
    body = unwrap_response(res)["integration"]
    assert body["target_url"] == "https://new.example.com/ingest"
    assert body["event_types"] == ["alert"]
    assert body["has_secrets"] is True  # token survived
    assert body["secrets_masked"] == {"token": "s3cr...3456"}


def test_patch_rotates_secret(integrations_api):
    _add(integrations_api)
    res = integrations_api.patch(
        "/api/v1/integrations/my-siem",
        json={"secrets": {"token": "rotated-token-999999"}},
    )
    assert res.status_code == 200
    body = unwrap_response(res)["integration"]
    assert body["secrets_masked"] == {"token": "rota...9999"}


def test_patch_empty_string_deletes_secret(integrations_api):
    _add(integrations_api, secrets={"token": "tok-123", "api_key": "api-key-9999"})
    res = integrations_api.patch(
        "/api/v1/integrations/my-siem",
        json={"secrets": {"token": "tok-123", "api_key": ""}},
    )
    assert res.status_code == 200
    body = unwrap_response(res)["integration"]
    assert body["has_secrets"] is True  # token still present
    assert body["secrets_masked"] == {"token": "****"}  # api_key deleted


def test_patch_unknown_404(integrations_api):
    res = integrations_api.patch("/api/v1/integrations/ghost", json={"target_url": "x"})
    assert res.status_code == 404


def test_patch_clears_payload_template(integrations_api):
    _add(integrations_api, payload_template='{"a": "{{agent_id}}"}')
    res = integrations_api.patch(
        "/api/v1/integrations/my-siem",
        json={"payload_template": ""},
    )
    assert res.status_code == 200
    assert unwrap_response(res)["integration"]["payload_template"] is None


# ─────────────────────────────────────────────────────────────────────────────
# Delete
# ─────────────────────────────────────────────────────────────────────────────


def test_delete_connector(integrations_api):
    _add(integrations_api)
    assert integrations_api.delete("/api/v1/integrations/my-siem").status_code == 200
    assert unwrap_response(integrations_api.get("/api/v1/integrations"))["total"] == 0
    assert integrations_api.delete("/api/v1/integrations/my-siem").status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Test action
# ─────────────────────────────────────────────────────────────────────────────


class _FakeResponse:
    def raise_for_status(self) -> None:
        pass


class _FakeClient:
    def __init__(self, captured: dict) -> None:
        self._captured = captured

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return None

    def request(self, method, url, content=None, headers=None, **kwargs) -> _FakeResponse:
        self._captured["method"] = method
        self._captured["url"] = url
        self._captured["headers"] = headers
        self._captured["body"] = __import__("json").loads(content)
        return _FakeResponse()


def test_test_endpoint_returns_sent(integrations_api, monkeypatch):
    from src.services import custom_integration_dispatcher

    captured: dict = {}
    monkeypatch.setattr(
        custom_integration_dispatcher.httpx, "Client", lambda timeout: _FakeClient(captured)
    )
    _add(integrations_api)

    res = integrations_api.post("/api/v1/integrations/my-siem/test", json={"event_type": "alert"})
    assert res.status_code == 200
    body = unwrap_response(res)
    assert body["status"] == "sent"
    assert body["event_type"] == "alert"
    # No secrets in the response body, ever.
    raw = res.json()
    assert "token" not in str(raw)
    # The sample event actually went to the configured target with auth.
    assert captured["url"] == "https://sink.example.com/ingest"
    assert captured["headers"]["Authorization"] == "Bearer s3cret-token-123456"
    assert captured["body"]["type"] == "alert"
    assert captured["body"]["risk_score"] == 85.0


def test_test_endpoint_invalid_event_type_422(integrations_api):
    _add(integrations_api)
    res = integrations_api.post(
        "/api/v1/integrations/my-siem/test", json={"event_type": "carrier_pigeon"}
    )
    assert res.status_code == 422


def test_test_endpoint_unknown_404(integrations_api):
    assert (
        integrations_api.post("/api/v1/integrations/nope/test", json={}).status_code == 404
    )
