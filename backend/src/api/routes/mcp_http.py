"""Tenant-authenticated Streamable HTTP MCP boundary.

This intentionally implements a small, managed MCP surface rather than a
transparent proxy.  The session is bound to a registered ARTSA agent and every
tool call is converted to the digest-only action contract before it reaches the
gateway.  It is therefore safe to expose inside a customer VPC without giving
clients an arbitrary GitHub or HTTP forwarding primitive.
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_tenant, get_db, get_redis
from src.data.orm import AgentORM, ApprovalRequestORM, MCPActionEvidenceORM
from src.services.github_execution import GitHubExecutionCoordinator
from src.services.mcp_gateway import GITHUB_READ_TOOLS, GatewayActionInput, MCPRuntimeGateway

router = APIRouter(tags=["Managed MCP Runtime"])

MAX_MCP_MESSAGE_BYTES = 256 * 1024
MCP_SESSION_TTL_SECONDS = 30 * 60

_gateway = MCPRuntimeGateway()
_execution = GitHubExecutionCoordinator(gateway=_gateway)


class JsonRpcFrame(BaseModel):
    """The minimal JSON-RPC 2.0 request shape accepted by ARTSA."""

    model_config = ConfigDict(extra="forbid")

    jsonrpc: str = Field(pattern=r"^2\.0$")
    method: str = Field(min_length=1, max_length=128)
    params: dict[str, Any] = Field(default_factory=dict)
    id: str | int | None = None


def _rpc_result(request_id: str | int | None, result: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _rpc_error(request_id: str | int | None, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def _session_key(session_id: str) -> str:
    return f"artsa:mcp:http:session:{session_id}"


async def _registered_agent(db: AsyncSession, tenant_id: str, agent_id: str) -> AgentORM | None:
    # Unit-mode routes intentionally use a no-op session. It must fail closed,
    # never turn a missing registry into implicit agent authority.
    if not hasattr(db, "execute"):
        return None
    return (
        await db.execute(
            select(AgentORM).where(AgentORM.id == agent_id, AgentORM.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()


async def _cancel_correlated_action(
    db: AsyncSession, *, tenant_id: str, session_id: str, action_id: str
) -> bool:
    """Cancel only a tenant/session-bound action that has not executed.

    Cancellation is deliberately terminal for approval-pending work. It cannot
    retract an already executed GitHub side effect; in that case the caller is
    told the cancellation arrived too late rather than being given a false
    cancellation confirmation.
    """
    if not hasattr(db, "execute"):
        return False
    row = (
        await db.execute(
            select(MCPActionEvidenceORM).where(
                MCPActionEvidenceORM.tenant_id == tenant_id,
                MCPActionEvidenceORM.session_id == session_id,
                MCPActionEvidenceORM.action_id == action_id,
            )
        )
    ).scalar_one_or_none()
    if row is None or row.execution_state != "PENDING":
        return False
    row.execution_state = "CANCELLED"
    row.outcome = "BLOCK"
    row.reason_codes = list(dict.fromkeys([*(row.reason_codes or []), "mcp_request_cancelled"]))
    if row.approval_id:
        approval = (
            await db.execute(
                select(ApprovalRequestORM).where(
                    ApprovalRequestORM.id == row.approval_id,
                    ApprovalRequestORM.tenant_id == tenant_id,
                    ApprovalRequestORM.status == "PENDING",
                )
            )
        ).scalar_one_or_none()
        if approval is not None:
            approval.status = "CANCELLED"
            approval.decision_at = datetime.now(UTC)
    await db.commit()
    return True


def _access_config(agent: AgentORM) -> dict[str, Any]:
    config = agent.config if isinstance(agent.config, dict) else {}
    return config.get("mcp_access", {}) if isinstance(config.get("mcp_access", {}), dict) else {}


def _tool_definitions(allowed_tools: set[str]) -> list[dict[str, Any]]:
    catalog: list[dict[str, Any]] = []
    managed_catalog = GITHUB_READ_TOOLS | {"github_create_issue"}
    for name in sorted(allowed_tools & managed_catalog):
        schema: dict[str, Any] = {
            "type": "object",
            "properties": {
                "installation_id": {"type": "string", "minLength": 1},
                "repository": {"type": "string", "pattern": "^[^/\\s]+/[^/\\s]+$"},
            },
            "required": ["installation_id", "repository"],
            "additionalProperties": False,
        }
        if name == "github_create_issue":
            schema["properties"].update(
                {
                    "title": {"type": "string", "minLength": 1, "maxLength": 256},
                    "body": {"type": "string", "maxLength": 65536},
                    "approval_retry_token": {"type": "string", "minLength": 16, "maxLength": 512},
                }
            )
            schema["required"].append("title")
        catalog.append({"name": name, "description": "ARTSA-managed GitHub action", "inputSchema": schema})
    return catalog


def _allowed(config: dict[str, Any], tool: str, installation_id: str, repository: str) -> bool:
    tools = {str(item) for item in config.get("allowed_tools", [])}
    installations = {str(item) for item in config.get("github_installations", [])}
    repositories = {str(item) for item in config.get("github_repositories", [])}
    return tool in tools and installation_id in installations and repository in repositories


def _validate_tool_arguments(tool: str, arguments: dict[str, Any]) -> tuple[bool, str]:
    """Apply the published MCP schemas server-side, not just in tools/list."""
    common = {"installation_id", "repository", "approval_retry_token"}
    allowed: dict[str, set[str]] = {
        "github_get_repository": common,
        "github_list_repositories": common,
        "github_list_issues": common,
        "github_get_issue": common | {"issue_number"},
        "github_list_pull_requests": common,
        "github_get_pull_request": common | {"pull_number"},
        "github_get_file_contents": common | {"path", "ref"},
        "github_create_issue": common | {"title", "body"},
    }
    if tool not in allowed:
        return False, "Tool is not part of the managed v1 MCP catalog"
    unexpected = set(arguments) - allowed[tool]
    if unexpected:
        return False, "Tool arguments include unsupported fields"
    if tool == "github_create_issue" and (not isinstance(arguments.get("title"), str) or not arguments["title"].strip()):
        return False, "github_create_issue requires a non-empty title"
    if tool == "github_get_issue" and (isinstance(arguments.get("issue_number"), bool) or not isinstance(arguments.get("issue_number"), int) or arguments["issue_number"] < 1):
        return False, "github_get_issue requires a positive issue_number"
    if tool == "github_get_pull_request" and (isinstance(arguments.get("pull_number"), bool) or not isinstance(arguments.get("pull_number"), int) or arguments["pull_number"] < 1):
        return False, "github_get_pull_request requires a positive pull_number"
    return True, ""


@router.post("/mcp", response_model=None)
async def streamable_http_mcp(
    request: Request,
    response: Response,
    mcp_session_id: str | None = Header(None, alias="Mcp-Session-Id"),
    tenant_id: str = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
) -> dict[str, Any]:
    """Handle `initialize`, `tools/list`, `tools/call`, and cancellation.

    Streamable HTTP permits a response body rather than requiring SSE for every
    call. Operations are bounded and time-limited by the downstream GitHub
    client; malformed, oversized or unregistered requests get JSON-RPC errors
    before policy evaluation.
    """
    raw = await request.body()
    if len(raw) > MAX_MCP_MESSAGE_BYTES:
        raise HTTPException(status_code=413, detail="MCP message exceeds 256 KiB")
    try:
        frame = JsonRpcFrame.model_validate_json(raw)
    except (ValidationError, ValueError):
        return _rpc_error(None, -32600, "Invalid JSON-RPC request")

    if frame.method == "initialize":
        agent_id = frame.params.get("agent_id")
        if not isinstance(agent_id, str) or not agent_id:
            return _rpc_error(frame.id, -32602, "initialize requires agent_id")
        agent = await _registered_agent(db, tenant_id, agent_id)
        config = _access_config(agent) if agent else {}
        if agent is None or not bool(config.get("enabled", False)):
            return _rpc_error(frame.id, -32001, "Registered MCP agent required")
        session_id = str(uuid.uuid4())
        # This is a genuine runtime observation, not a health inference from
        # configuration. It powers the operator's last-seen status.
        agent.last_seen = datetime.now(UTC)
        await db.commit()
        redis.set(
            _session_key(session_id),
            json.dumps({"tenant_id": tenant_id, "agent_id": agent.id, "created_at": datetime.now(UTC).isoformat()}),
            ttl_sec=MCP_SESSION_TTL_SECONDS,
        )
        response.headers["Mcp-Session-Id"] = session_id
        return _rpc_result(
            frame.id,
            {"protocolVersion": "2025-03-26", "serverInfo": {"name": "ARTSA managed GitHub MCP", "version": "v1"}, "capabilities": {"tools": {}}},
        )

    if not mcp_session_id:
        return _rpc_error(frame.id, -32002, "Mcp-Session-Id header is required")
    try:
        session = json.loads(redis.get(_session_key(mcp_session_id)) or "")
    except json.JSONDecodeError:
        session = {}
    if session.get("tenant_id") != tenant_id or not isinstance(session.get("agent_id"), str):
        return _rpc_error(frame.id, -32002, "MCP session is invalid or expired")
    agent = await _registered_agent(db, tenant_id, session["agent_id"])
    config = _access_config(agent) if agent else {}
    if agent is None or not bool(config.get("enabled", False)):
        return _rpc_error(frame.id, -32001, "Registered MCP agent required")

    if frame.method == "notifications/cancelled":
        request_id = frame.params.get("requestId")
        lookup_key = f"artsa:mcp:http:request:{mcp_session_id}:{request_id}"
        action_id = redis.get(lookup_key) if request_id is not None else None
        cancelled = isinstance(action_id, str) and await _cancel_correlated_action(
            db, tenant_id=tenant_id, session_id=mcp_session_id, action_id=action_id
        )
        return _rpc_result(frame.id, {"cancelled": cancelled})
    if frame.method == "tools/list":
        return _rpc_result(frame.id, {"tools": _tool_definitions({str(item) for item in config.get("allowed_tools", [])})})
    if frame.method != "tools/call":
        return _rpc_error(frame.id, -32601, "Method not supported")

    tool = frame.params.get("name")
    arguments = frame.params.get("arguments")
    if not isinstance(tool, str) or not isinstance(arguments, dict):
        return _rpc_error(frame.id, -32602, "tools/call requires a name and object arguments")
    installation_id, repository = arguments.get("installation_id"), arguments.get("repository")
    if not isinstance(installation_id, str) or not isinstance(repository, str):
        return _rpc_error(frame.id, -32602, "installation_id and repository are required")
    if not _allowed(config, tool, installation_id, repository):
        return _rpc_result(frame.id, {"isError": True, "content": [{"type": "text", "text": "Blocked: agent authority does not cover this action."}]})
    valid, error = _validate_tool_arguments(tool, arguments)
    if not valid:
        return _rpc_error(frame.id, -32602, error)

    action_arguments = {key: value for key, value in arguments.items() if key not in {"installation_id", "repository", "approval_retry_token"}}
    payload = GatewayActionInput(
        session_id=uuid.UUID(mcp_session_id),
        trace_id=str(frame.params.get("trace_id") or uuid.uuid4()),
        agent_id=agent.id,
        actor_id=str(frame.params.get("actor_id")) if frame.params.get("actor_id") else None,
        github_installation_id=installation_id,
        tool=tool,
        resource=repository,
        operation=tool.removeprefix("github_"),
        arguments=action_arguments,
        approval_retry_token=arguments.get("approval_retry_token") if isinstance(arguments.get("approval_retry_token"), str) else None,
    )
    # A cancellation notification carries the JSON-RPC request ID, not our
    # action ID. Retain only that opaque correlation for the session TTL.
    if frame.id is not None:
        redis.set(
            f"artsa:mcp:http:request:{mcp_session_id}:{frame.id}",
            str(payload.action_id),
            ttl_sec=MCP_SESSION_TTL_SECONDS,
        )
    if tool in GITHUB_READ_TOOLS:
        execution = await _execution.execute_read(db, tenant_id=tenant_id, payload=payload)
        await db.commit()
        if execution.decision.outcome.value != "ALLOW":
            message = f"{execution.decision.outcome.value}: {', '.join(execution.decision.reason_codes) or 'policy evaluated'}"
            content = [{"type": "text", "text": message}]
        else:
            # The adapter result passed the output gate. It is intentionally
            # returned only to this authenticated MCP client, never persisted.
            content = [{"type": "text", "text": json.dumps(execution.tool_result, separators=(",", ":"), default=str)}]
        return _rpc_result(frame.id, {"isError": execution.decision.outcome.value != "ALLOW", "content": content, "_meta": {"actionId": str(execution.decision.action_id), "evidenceId": str(execution.decision.evidence_id)}})

    execution = await _execution.execute(db, redis=redis, tenant_id=tenant_id, payload=payload)
    await db.commit()
    message = f"{execution.decision.outcome.value}: {execution.execution_state.value}"
    return _rpc_result(frame.id, {"isError": execution.decision.outcome.value != "ALLOW", "content": [{"type": "text", "text": message}], "_meta": {"actionId": str(execution.decision.action_id), "evidenceId": str(execution.decision.evidence_id), "approvalId": execution.decision.approval_id, "approvalRequired": execution.decision.outcome.value == "REQUIRE_APPROVAL"}})
