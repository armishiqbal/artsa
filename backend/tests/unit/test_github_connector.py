"""Bounded GitHub Cloud adapter tests using an in-memory HTTP transport."""

from __future__ import annotations

import hashlib
import hmac

import httpx
import pytest
from src.services.github_connector import (
    GitHubAppClient,
    GitHubConfigurationError,
    GitHubToolNotSupported,
    verify_github_webhook_signature,
)


def test_webhook_signature_requires_a_valid_sha256_signature() -> None:
    body = b'{"action":"created"}'
    signature = "sha256=" + hmac.new(b"secret", body, hashlib.sha256).hexdigest()
    assert verify_github_webhook_signature(body, signature, "secret")
    assert not verify_github_webhook_signature(body, signature, "other-secret")
    assert not verify_github_webhook_signature(body, None, "secret")


@pytest.mark.asyncio
async def test_rejects_all_non_catalog_operations_before_minting_a_token() -> None:
    client = GitHubAppClient(client=httpx.AsyncClient(transport=httpx.MockTransport(lambda _: None)))
    with pytest.raises(GitHubToolNotSupported):
        await client.execute_read(
            installation_id="1", tool="github_delete_repository", resource="org/repo", arguments={}
        )
    await client.close()


@pytest.mark.asyncio
async def test_requires_github_app_credentials_before_a_live_call(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("src.services.github_connector.settings.ARTSA_GITHUB_APP_ID", None)
    monkeypatch.setattr("src.services.github_connector.settings.ARTSA_GITHUB_APP_PRIVATE_KEY", None)
    client = GitHubAppClient()
    with pytest.raises(GitHubConfigurationError):
        await client.installation_token("1")
    await client.close()


@pytest.mark.asyncio
async def test_create_issue_uses_repository_scoped_issues_write_token() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/app/installations/1/access_tokens":
            return httpx.Response(201, json={"token": "opaque-token", "expires_at": "2099-01-01T00:00:00Z"})
        assert request.url.path == "/repos/acme/repo/issues"
        return httpx.Response(201, json={"number": 42})

    client = GitHubAppClient(
        client=httpx.AsyncClient(base_url="https://api.github.com", transport=httpx.MockTransport(handler))
    )
    client._app_jwt = lambda: "test-jwt"  # type: ignore[method-assign]
    result = await client.execute_create_issue(
        installation_id="1", resource="acme/repo", arguments={"title": "Security review"}
    )
    assert result.data == {"number": 42}
    token_request = requests[0]
    assert token_request.method == "POST"
    assert token_request.content == b'{"repositories":["repo"],"permissions":{"issues":"write"}}'
    await client.close()
