"""SSRF guard tests for the LLM reverse-proxy forwarding path."""

import socket
from unittest.mock import Mock

import httpx
import pytest
from fastapi.testclient import TestClient
from src.core.config import settings
from src.gateway.llm_proxy import LLMProxy
from src.gateway.url_safety import (
    SSRFBlockedError,
    _is_internal_ip,
    check_proxy_target,
    validate_target_url,
)
from src.services.prompt_scanner import PromptScanner

SAFE_PROMPT = "Summarize the quarterly financial report and list the top risks."


# ─────────────────────────────────────────────────────────────────────────────
# _is_internal_ip address classification
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "addr",
    [
        "127.0.0.1",  # loopback
        "127.0.0.2",
        "0.0.0.0",  # unspecified / any
        "10.0.0.1",  # RFC1918
        "172.16.0.1",
        "172.31.255.255",
        "192.168.0.1",
        "100.64.0.1",  # CGNAT
        "169.254.169.254",  # cloud metadata (link-local)
        "169.254.0.1",
        "198.18.0.1",  # benchmarking
        "240.0.0.1",  # reserved
        "255.255.255.255",  # broadcast
        "::1",  # IPv6 loopback
        "::",  # IPv6 unspecified
        "fe80::1",  # link-local
        "fc00::1",  # unique-local
        "fd12:3456:789a:1::1",
        "::ffff:127.0.0.1",  # IPv4-mapped loopback
        "::ffff:10.0.0.1",
    ],
)
def test_is_internal_ip_marks_non_public_addresses(addr):
    assert _is_internal_ip(addr), f"{addr} should be treated as internal"


@pytest.mark.parametrize(
    "addr",
    ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111", "not-an-ip"],
)
def test_is_internal_ip_leaves_public_addresses(addr):
    assert not _is_internal_ip(addr), f"{addr} should be treated as external"


# ─────────────────────────────────────────────────────────────────────────────
# Static URL validation
# ─────────────────────────────────────────────────────────────────────────────


def test_validate_target_url_blocks_internal_literals(monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_PROXY_ALLOW_INTERNAL_TARGETS", False)
    for url in (
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1:9000/s3",
        "http://127.0.0.1:8000/v1",
        "http://192.168.1.10/internal",
        "http://[::1]:11434/v1",
        "http://0.0.0.0/whatever",
    ):
        with pytest.raises(SSRFBlockedError):
            validate_target_url(url)


def test_validate_target_url_allows_public_targets(monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_PROXY_ALLOW_INTERNAL_TARGETS", False)
    for url in (
        "https://api.openai.com/v1/chat/completions",
        "https://api.anthropic.com/v1/messages",
        "http://example.com/v1",
        "https://api.groq.com/openai/v1",
    ):
        validate_target_url(url)  # must not raise


def test_validate_target_url_rejects_non_http_schemes(monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_PROXY_ALLOW_INTERNAL_TARGETS", False)
    for url in ("ftp://example.com/file", "file:///etc/passwd", "gopher://127.0.0.1:70/"):
        with pytest.raises(SSRFBlockedError):
            validate_target_url(url)


# ─────────────────────────────────────────────────────────────────────────────
# DNS-resolving check
# ─────────────────────────────────────────────────────────────────────────────


async def test_check_proxy_target_blocks_hostname_resolving_internal(monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_PROXY_ALLOW_INTERNAL_TARGETS", False)

    def fake_getaddrinfo(host, port, *args, **kwargs):
        assert host == "metadata.local"
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("169.254.169.254", 0))]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
    with pytest.raises(SSRFBlockedError):
        await check_proxy_target("http://metadata.local/v1")


async def test_check_proxy_target_allows_public_hostname(monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_PROXY_ALLOW_INTERNAL_TARGETS", False)

    def fake_getaddrinfo(host, port, *args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 0))]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
    await check_proxy_target("https://public.example.com/v1")  # must not raise


async def test_check_proxy_target_allows_unresolvable_host(monkeypatch):
    """A host that fails to resolve is allowed (the connect would fail anyway)."""
    monkeypatch.setattr(settings, "ARTSA_PROXY_ALLOW_INTERNAL_TARGETS", False)
    monkeypatch.setattr(socket, "getaddrinfo", Mock(side_effect=socket.gaierror("nxdomain")))
    await check_proxy_target("http://unresolvable.invalid/v1")  # must not raise


async def test_check_proxy_target_skips_when_internal_allowed(monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_PROXY_ALLOW_INTERNAL_TARGETS", True)
    await check_proxy_target("http://169.254.169.254/v1")  # must not raise


# ─────────────────────────────────────────────────────────────────────────────
# End-to-end through the proxy route (guard must fire before any HTTP connect)
# ─────────────────────────────────────────────────────────────────────────────


def _fake_upstream_handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "id": "chatcmpl-ssrf",
            "object": "chat.completion",
            "model": "gpt-4o",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "mock reply"},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 2, "completion_tokens": 4},
        },
    )


@pytest.fixture
def proxy_client(monkeypatch):
    from src.api.main import create_app

    proxy = LLMProxy(scanner=PromptScanner(), transport=httpx.MockTransport(_fake_upstream_handler))
    monkeypatch.setattr("src.api.routes.proxy.get_llm_proxy", lambda: proxy)
    app = create_app()
    return TestClient(app)


def _safe_body(**overrides):
    body = {
        "model": "gpt-4o",
        "messages": [{"role": "user", "content": SAFE_PROMPT}],
    }
    body.update(overrides)
    return body


def test_proxy_blocks_internal_forward_to(proxy_client, monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_PROXY_ALLOW_INTERNAL_TARGETS", False)
    res = proxy_client.post(
        "/api/v1/proxy/v1/chat/completions",
        headers={"X-ARTSA-Forward-To": "http://169.254.169.254/v1"},
        json=_safe_body(),
    )
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "proxy_target_blocked"


def test_proxy_blocks_internal_env_target(proxy_client, monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_PROXY_ALLOW_INTERNAL_TARGETS", False)
    monkeypatch.setattr(settings, "ARTSA_PROXY_TARGET_BASE_URL", "http://127.0.0.1:9")
    res = proxy_client.post(
        "/api/v1/proxy/v1/chat/completions",
        json=_safe_body(),
    )
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "proxy_target_blocked"


def test_proxy_blocks_internal_target_anthropic(proxy_client, monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_PROXY_ALLOW_INTERNAL_TARGETS", False)
    res = proxy_client.post(
        "/api/v1/proxy/v1/messages",
        headers={"X-ARTSA-Forward-To": "http://10.0.0.5/v1"},
        json={
            "model": "claude-3-5-sonnet",
            "max_tokens": 64,
            "messages": [{"role": "user", "content": SAFE_PROMPT}],
        },
    )
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "proxy_target_blocked"


def test_proxy_streaming_blocks_internal_target(proxy_client, monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_PROXY_ALLOW_INTERNAL_TARGETS", False)
    res = proxy_client.post(
        "/api/v1/proxy/v1/chat/completions",
        headers={"X-ARTSA-Forward-To": "http://10.0.0.9/v1"},
        json=_safe_body(stream=True),
    )
    assert res.status_code == 200  # SSE is still 200; the error is inside the stream
    assert "proxy_target_blocked" in res.text


def test_proxy_allows_internal_forward_to_when_opted_in(proxy_client, monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_PROXY_ALLOW_INTERNAL_TARGETS", True)
    res = proxy_client.post(
        "/api/v1/proxy/v1/chat/completions",
        headers={"X-ARTSA-Forward-To": "http://localhost:11434/v1"},
        json=_safe_body(),
    )
    assert res.status_code == 200
    assert res.json()["choices"][0]["message"]["content"] == "mock reply"
