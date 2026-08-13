"""Tests for the Settings API — notification-preference GET/PUT round-trip.

The settings router also exposes audit log / team / tenant endpoints; the
notification-preference pair is the canonical GET/PUT contract and is what the
UI's notification page consumes.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from src.api.main import create_app
from tests.conftest import unwrap_response


def _client() -> TestClient:
    return TestClient(create_app())


def test_notifications_get_returns_defaults():
    with _client() as client:
        res = client.get("/api/v1/settings/notifications")
        assert res.status_code == 200
        body = unwrap_response(res)
        assert body["tenant_id"] == "default_tenant"
        prefs = body["preferences"]
        assert prefs["email_digest_enabled"] is False
        assert prefs["email_digest_frequency"] == "daily"
        assert prefs["slack_enabled"] is False


def test_notifications_put_round_trip():
    """PUT persists the prefs and a subsequent GET returns them unchanged."""
    with _client() as client:
        put = client.put(
            "/api/v1/settings/notifications",
            headers={"X-Tenant-ID": "rt-test"},
            json={
                "email_digest_enabled": True,
                "email_digest_frequency": "weekly",
                "email_recipients": ["sec@example.com"],
                "slack_enabled": True,
                "slack_channel": "#containment",
                "pagerduty_severity_threshold": "CRITICAL",
            },
        )
        assert put.status_code == 200
        saved = unwrap_response(put)
        assert saved["status"] == "saved"
        assert saved["preferences"]["email_digest_frequency"] == "weekly"

        got = unwrap_response(client.get("/api/v1/settings/notifications", headers={"X-Tenant-ID": "rt-test"}))
        prefs = got["preferences"]
        assert prefs["email_digest_enabled"] is True
        assert prefs["email_digest_frequency"] == "weekly"
        assert prefs["email_recipients"] == ["sec@example.com"]
        assert prefs["slack_enabled"] is True
        assert prefs["slack_channel"] == "#containment"
        assert prefs["pagerduty_severity_threshold"] == "CRITICAL"


def test_notification_prefs_are_tenant_scoped():
    """Updating one tenant's prefs never leaks into another tenant's."""
    with _client() as client:
        client.put(
            "/api/v1/settings/notifications",
            headers={"X-Tenant-ID": "acme"},
            json={"email_digest_enabled": True, "email_digest_frequency": "realtime"},
        )
        acme = unwrap_response(client.get("/api/v1/settings/notifications", headers={"X-Tenant-ID": "acme"}))
        assert acme["preferences"]["email_digest_frequency"] == "realtime"

        other = unwrap_response(client.get("/api/v1/settings/notifications", headers={"X-Tenant-ID": "other-co"}))
        assert other["preferences"]["email_digest_frequency"] == "daily"
