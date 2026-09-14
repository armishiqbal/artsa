from uuid import uuid4

import pytest
from pydantic import ValidationError
from src.mcp.contracts import ActionOutcome, ActionRequest


def test_action_request_is_digest_only_and_versioned():
    request = ActionRequest(
        tenant_id="tenant-a", session_id=uuid4(), trace_id="trace-1", agent_id="agent-1",
        integration="github", github_installation_id="123", tool="create_pull_request", resource="acme/repo",
        operation="pull_request.create", arguments_sha256="a" * 64, policy_version="v1",
    )
    assert request.schema_version == 1
    assert request.arguments_sha256 == "a" * 64


def test_action_request_rejects_raw_arguments_and_invalid_digests():
    base = {
        "tenant_id": "tenant-a", "session_id": uuid4(), "trace_id": "trace-1", "agent_id": "agent-1",
        "integration": "github", "github_installation_id": "123", "tool": "create_issue", "resource": "acme/repo", "operation": "issue.create",
        "arguments_sha256": "bad", "policy_version": "v1",
    }
    with pytest.raises(ValidationError):
        ActionRequest(**base, arguments={"title": "secret"})


def test_unavailable_is_explicit_terminal_outcome():
    assert ActionOutcome.UNAVAILABLE.value == "UNAVAILABLE"
