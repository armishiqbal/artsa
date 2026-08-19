"""Tests for the Provider Management API (add any API key / provider / model).

Covers: catalog, CRUD with masked keys, encryption round-trip, proxy target
resolution from registered providers, model defaulting, and end-to-end
proxy forwarding with a user-registered provider.
"""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from src.gateway.llm_proxy import LLMProxy
from src.services.prompt_scanner import PromptScanner

from tests.conftest import unwrap_response

REAL_KEY = "sk-test-1234567890abcdef"
FAKE_URL = "https://provider.example.test/v1"


@pytest.fixture
def provider_api(monkeypatch, tmp_path):
    """Isolated DB + clean registry, ready for TestClient requests."""
    db = tmp_path / "test_providers.db"
    monkeypatch.setattr("src.core.config.settings.DATABASE_URL", f"sqlite+aiosqlite:///{db}")
    monkeypatch.setattr("src.core.config.settings.SYNC_DATABASE_URL", f"sqlite:///{db}")
    # Force the async engine/session singletons to rebuild with the temp URL.
    monkeypatch.setattr("src.data.db._engine", None)
    monkeypatch.setattr("src.data.db._session_factory", None)

    from src.data.orm import Base

    sync_engine = create_engine(f"sqlite:///{db}")
    Base.metadata.create_all(sync_engine)
    sync_engine.dispose()

    from src.api.main import create_app
    from src.services.provider_registry import provider_registry

    provider_registry.load([])
    return TestClient(create_app())


def _add_provider(client: TestClient, name: str = "my-groq", **overrides) -> httpx.Response:
    payload = {
        "name": name,
        "api_key": REAL_KEY,
        "provider_type": "groq",
        "base_url": FAKE_URL,
        "default_model": "llama-3.3-70b-versatile",
        "enabled": True,
        **overrides,
    }
    return client.post("/api/v1/providers", json=payload)


# ─────────────────────────────────────────────────────────────────────────────
# Catalog
# ─────────────────────────────────────────────────────────────────────────────


def test_catalog_lists_all_provider_options(provider_api):
    res = provider_api.get("/api/v1/providers/catalog")
    assert res.status_code == 200
    catalog = unwrap_response(res)["catalog"]
    for name in ("openai", "anthropic", "groq", "mistral", "deepseek", "openrouter", "ollama", "local"):
        assert name in catalog, f"catalog missing {name}"
    assert catalog["deepseek"]["default_model"] == "deepseek-v4-flash"


# ─────────────────────────────────────────────────────────────────────────────
# CRUD + key masking
# ─────────────────────────────────────────────────────────────────────────────


def test_add_provider_and_masked_key(provider_api):
    res = _add_provider(provider_api)
    assert res.status_code == 201
    body = unwrap_response(res)["provider"]
    assert body["name"] == "my-groq"  # slugified
    assert body["api_key_masked"] == "sk-t...cdef"
    assert "api_key" not in body  # never echoed

    listed = unwrap_response(provider_api.get("/api/v1/providers"))
    assert listed["count"] == 1
    stored = listed["providers"][0]
    assert stored["api_key_masked"] == "sk-t...cdef"
    assert "api_key" not in stored


def test_upsert_updates_existing_provider(provider_api):
    _add_provider(provider_api)
    res = _add_provider(provider_api, api_key="sk-new-key-9999", default_model="updated-model")
    assert res.status_code == 201
    assert unwrap_response(res)["provider"]["default_model"] == "updated-model"
    assert unwrap_response(provider_api.get("/api/v1/providers"))["count"] == 1


def test_duplicate_name_normalizes_to_single_row(provider_api):
    """Two display names that slugify to the same provider name collide into a
    single row (the upsert resolves the conflict) — never a silent duplicate."""
    _add_provider(provider_api, name="My Groq")
    _add_provider(provider_api, name="my-groq", default_model="normalized-model")
    listed = unwrap_response(provider_api.get("/api/v1/providers"))
    assert listed["count"] == 1
    assert listed["providers"][0]["name"] == "my-groq"
    assert listed["providers"][0]["default_model"] == "normalized-model"


# ─────────────────────────────────────────────────────────────────────────────
# PATCH (partial update)
# ─────────────────────────────────────────────────────────────────────────────


def test_patch_partial_update_preserves_key(provider_api):
    """PATCH only touches the fields sent — the stored key survives."""
    _add_provider(provider_api)
    res = provider_api.patch(
        "/api/v1/providers/my-groq",
        json={"base_url": "https://new.example.test/v1"},
    )
    assert res.status_code == 200
    body = unwrap_response(res)["provider"]
    assert body["base_url"] == "https://new.example.test/v1"
    assert body["default_model"] == "llama-3.3-70b-versatile"  # untouched
    assert body["api_key_masked"] == "sk-t...cdef"  # key not rotated
    assert unwrap_response(provider_api.get("/api/v1/providers"))["count"] == 1


def test_patch_rotates_api_key(provider_api):
    _add_provider(provider_api)
    res = provider_api.patch(
        "/api/v1/providers/my-groq",
        json={"api_key": "sk-rotated-0000", "default_model": "patched-model"},
    )
    assert res.status_code == 200
    body = unwrap_response(res)["provider"]
    assert body["api_key_masked"] == "sk-r...0000"
    assert body["default_model"] == "patched-model"


def test_patch_unknown_provider_404(provider_api):
    res = provider_api.patch("/api/v1/providers/ghost", json={"base_url": "x"})
    assert res.status_code == 404


def test_delete_provider(provider_api):
    _add_provider(provider_api)
    assert provider_api.delete("/api/v1/providers/my-groq").status_code == 200
    assert unwrap_response(provider_api.get("/api/v1/providers"))["count"] == 0
    assert provider_api.delete("/api/v1/providers/my-groq").status_code == 404


def test_test_endpoint_unknown_provider_404(provider_api):
    assert provider_api.post("/api/v1/providers/nope/test", json={}).status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Proxy integration with registered providers
# ─────────────────────────────────────────────────────────────────────────────


def test_proxy_resolves_registered_provider(provider_api):
    _add_provider(provider_api)
    proxy = LLMProxy(scanner=PromptScanner())
    base_url, api_key, headers = proxy.resolve_target("my-groq")
    assert base_url == FAKE_URL
    assert api_key == REAL_KEY
    assert headers == {}
    # Model defaulting from the registered provider.
    assert proxy.resolve_model("my-groq", "unknown") == "llama-3.3-70b-versatile"
    # Unknown providers still fall back to catalog defaults.
    assert proxy.resolve_target("deepseek")[0] == "https://api.deepseek.com/v1"


def test_proxy_forwards_via_registered_provider(provider_api, monkeypatch):
    """End-to-end: proxy routes a safe prompt to the user-registered endpoint
    with the user's key."""
    _add_provider(provider_api)
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("Authorization", "")
        return httpx.Response(
            200,
            json={
                "id": "chatcmpl-x",
                "object": "chat.completion",
                "model": "llama-3.3-70b-versatile",
                "choices": [
                    {"index": 0, "message": {"role": "assistant", "content": "mocked reply"}, "finish_reason": "stop"}
                ],
            },
        )

    proxy = LLMProxy(scanner=PromptScanner(), transport=httpx.MockTransport(handler))
    monkeypatch.setattr("src.api.routes.proxy.get_llm_proxy", lambda: proxy)

    res = provider_api.post(
        "/api/v1/proxy/v1/chat/completions",
        headers={"X-ARTSA-Provider": "my-groq"},
        json={"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": "Hello"}]},
    )
    assert res.status_code == 200
    assert captured["url"] == f"{FAKE_URL}/chat/completions"
    assert captured["auth"] == f"Bearer {REAL_KEY}"
    assert res.json()["choices"][0]["message"]["content"] == "mocked reply"
