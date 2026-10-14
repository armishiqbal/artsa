"""Agents Management and Baseline Endpoints."""


from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_tenant, get_db
from src.core.models.agents import Agent, AgentBaseline
from src.data.orm import AgentORM, EventEvaluationORM, SessionORM, ToolCallEventORM
from src.data.repositories.agents import AgentsRepository

router = APIRouter(tags=["Agents"])


class MCPAgentRegistration(BaseModel):
    """Explicit authority needed to attach an agent to the HTTP MCP gateway."""

    model_config = ConfigDict(extra="forbid")

    # ``agents.id`` is the pre-existing stable 36-character identifier used by
    # sessions and evidence; reject longer values at the API boundary rather
    # than relying on database-specific VARCHAR behavior.
    id: str = Field(min_length=1, max_length=36)
    name: str = Field(min_length=1, max_length=255)
    owner: str = Field(min_length=1, max_length=255)
    purpose: str = Field(min_length=1, max_length=512)
    allowed_tools: list[str] = Field(min_length=1, max_length=20)
    github_installations: list[str] = Field(min_length=1, max_length=20)
    github_repositories: list[str] = Field(min_length=1, max_length=100)
    enabled: bool = True


def _mcp_registration_view(row: AgentORM) -> dict[str, Any]:
    config = row.config if isinstance(row.config, dict) else {}
    access = config.get("mcp_access", {}) if isinstance(config.get("mcp_access", {}), dict) else {}
    return {
        "id": row.id,
        "name": row.name,
        "owner": access.get("owner"),
        "purpose": access.get("purpose"),
        "allowed_tools": access.get("allowed_tools", []),
        "github_installations": access.get("github_installations", []),
        "github_repositories": access.get("github_repositories", []),
        "enabled": bool(access.get("enabled", False)),
        "last_seen": row.last_seen,
    }

_BUILTIN_AGENTS: list[Agent] = [
    Agent(
        id="agent-support-01",
        tenant_id="default_tenant",
        name="Customer Support Agent",
        status="HEALTHY",
        total_sessions=42,
        total_breaches=0,
    ),
    Agent(
        id="agent-sql-02",
        tenant_id="default_tenant",
        name="SQL Orchestrator Agent",
        status="AT_RISK",
        total_sessions=18,
        total_breaches=1,
    ),
    Agent(
        id="agent-exec-03",
        tenant_id="default_tenant",
        name="Admin Command Executor",
        status="QUARANTINED",
        total_sessions=5,
        total_breaches=3,
    ),
]

_BUILTIN_AGENT_IDS = {agent.id for agent in _BUILTIN_AGENTS}

# Legacy behavior: built-in agents live under the default tenant.
_DEFAULT_TENANT = "default_tenant"


@router.get("/agents/registry/mcp")
async def list_mcp_agent_registrations(
    db: AsyncSession = Depends(get_db), tenant_id: str = Depends(get_current_tenant)
) -> list[dict[str, Any]]:
    rows = (
        await db.execute(select(AgentORM).where(AgentORM.tenant_id == tenant_id).order_by(AgentORM.name))
    ).scalars().all()
    return [_mcp_registration_view(row) for row in rows if "mcp_access" in (row.config or {})]


@router.get("/agents/inventory")
async def list_agent_inventory(
    db: AsyncSession = Depends(get_db), tenant_id: str = Depends(get_current_tenant)
) -> list[dict[str, Any]]:
    """Return tenant-owned registered agents with bounded runtime evidence."""
    agents = (
        await db.execute(
            select(AgentORM)
            .where(AgentORM.tenant_id == tenant_id)
            .order_by(AgentORM.name)
        )
    ).scalars().all()
    session_stats = (
        await db.execute(
            select(
                SessionORM.agent_id,
                func.count(SessionORM.id),
                func.sum(SessionORM.containment_breaches),
                func.max(SessionORM.started_at),
            )
            .where(SessionORM.tenant_id == tenant_id)
            .group_by(SessionORM.agent_id)
        )
    ).all()
    stats_by_agent = {
        agent_id: {
            "session_count": int(session_count or 0),
            "breach_count": int(breach_count or 0),
            "last_activity": last_activity,
        }
        for agent_id, session_count, breach_count, last_activity in session_stats
    }

    ranked_events = (
        select(
            ToolCallEventORM.agent_id.label("agent_id"),
            ToolCallEventORM.tool_name.label("tool_name"),
            ToolCallEventORM.timestamp.label("timestamp"),
            ToolCallEventORM.session_id.label("session_id"),
            func.row_number()
            .over(
                partition_by=ToolCallEventORM.agent_id,
                order_by=ToolCallEventORM.timestamp.desc(),
            )
            .label("event_rank"),
        )
        .where(ToolCallEventORM.tenant_id == tenant_id)
        .subquery()
    )
    latest_events = (
        await db.execute(
            select(
                ranked_events.c.agent_id,
                ranked_events.c.tool_name,
                ranked_events.c.timestamp,
                ranked_events.c.session_id,
            ).where(ranked_events.c.event_rank == 1)
        )
    ).all()
    latest_tool_by_agent: dict[str, dict[str, Any]] = {}
    for agent_id, tool_name, timestamp, session_id in latest_events:
        latest_tool_by_agent.setdefault(
            agent_id,
            {"tool_name": tool_name, "timestamp": timestamp, "session_id": session_id},
        )

    inventory: list[dict[str, Any]] = []
    for agent in agents:
        config = agent.config if isinstance(agent.config, dict) else {}
        access = config.get("mcp_access") if isinstance(config.get("mcp_access"), dict) else {}
        stats = stats_by_agent.get(agent.id, {})
        latest_tool = latest_tool_by_agent.get(agent.id, {})
        inventory.append({
            "id": agent.id,
            "name": agent.name,
            "agent_type": agent.agent_type,
            "provider": agent.provider or None,
            "model": agent.model or None,
            "status": agent.status,
            "owner": access.get("owner"),
            "purpose": access.get("purpose"),
            "allowed_tools": access.get("allowed_tools", []),
            "github_repositories": access.get("github_repositories", []),
            "enabled": access.get("enabled") if "mcp_access" in config else None,
            "session_count": stats.get("session_count", 0),
            "breach_count": stats.get("breach_count", 0),
            "last_activity": latest_tool.get("timestamp") or stats.get("last_activity"),
            "last_tool_name": latest_tool.get("tool_name"),
            "last_session_id": latest_tool.get("session_id"),
            "registered": True,
        })
    return inventory


@router.get("/agents/{agent_id}/evidence")
async def get_agent_evidence(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
) -> list[dict[str, Any]]:
    """Return minimal, tenant-scoped tool evidence for one registered agent."""
    agent = (
        await db.execute(
            select(AgentORM.id).where(AgentORM.id == agent_id, AgentORM.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    rows = (
        await db.execute(
            select(
                ToolCallEventORM.id,
                ToolCallEventORM.session_id,
                ToolCallEventORM.tool_name,
                ToolCallEventORM.timestamp,
                ToolCallEventORM.trace_id,
                ToolCallEventORM.post_exec_redacted,
                EventEvaluationORM.verdict,
                EventEvaluationORM.risk_score,
                EventEvaluationORM.recommended_action,
            )
            .join(
                SessionORM,
                (SessionORM.id == ToolCallEventORM.session_id)
                & (SessionORM.tenant_id == tenant_id),
            )
            .outerjoin(
                EventEvaluationORM,
                (EventEvaluationORM.event_id == ToolCallEventORM.id)
                & (EventEvaluationORM.tenant_id == tenant_id),
            )
            .where(
                ToolCallEventORM.agent_id == agent_id,
                ToolCallEventORM.tenant_id == tenant_id,
            )
            .order_by(ToolCallEventORM.timestamp.desc())
            .limit(6)
        )
    ).all()
    return [
        {
            "id": event_id,
            "session_id": session_id,
            "tool_name": tool_name,
            "timestamp": timestamp,
            "trace_id": trace_id,
            "post_exec_redacted": post_exec_redacted,
            "verdict": verdict,
            "risk_score": risk_score,
            "recommended_action": recommended_action,
        }
        for (
            event_id,
            session_id,
            tool_name,
            timestamp,
            trace_id,
            post_exec_redacted,
            verdict,
            risk_score,
            recommended_action,
        ) in rows
    ]


@router.put("/agents/registry/mcp/{agent_id}")
async def register_mcp_agent(
    agent_id: str,
    payload: MCPAgentRegistration,
    db: AsyncSession = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant),
) -> dict[str, Any]:
    """Create or update a tenant-owned agent's bounded MCP authority."""
    if payload.id != agent_id:
        raise HTTPException(status_code=400, detail="agent id must match the request path")
    row = (
        await db.execute(select(AgentORM).where(AgentORM.id == agent_id, AgentORM.tenant_id == tenant_id))
    ).scalar_one_or_none()
    access = {
        "enabled": payload.enabled,
        "owner": payload.owner,
        "purpose": payload.purpose,
        "allowed_tools": sorted(set(payload.allowed_tools)),
        "github_installations": sorted(set(payload.github_installations)),
        "github_repositories": sorted(set(payload.github_repositories)),
    }
    if row is None:
        row = AgentORM(
            id=agent_id, tenant_id=tenant_id, name=payload.name, agent_type="managed_mcp",
            config={"mcp_access": access}, last_seen=datetime.now(UTC),
        )
        db.add(row)
    else:
        row.name = payload.name
        row.config = {**(row.config or {}), "mcp_access": access}
        row.last_seen = datetime.now(UTC)
    await db.commit()
    await db.refresh(row)
    return _mcp_registration_view(row)


async def _seed_builtin_agents(session: AsyncSession) -> None:
    """Persist the built-in agents on first access so legacy lookups keep working."""
    repo = AgentsRepository(session)
    existing = await repo.list_agents(_DEFAULT_TENANT)
    existing_ids = {agent.id for agent in existing}
    for agent in _BUILTIN_AGENTS:
        if agent.id not in existing_ids:
            await repo.upsert_agent(agent)


@router.get("/agents", response_model=list[Agent])
async def list_agents(session: AsyncSession = Depends(get_db)):
    """List registered AI agents."""
    repo = AgentsRepository(session)
    agents = await repo.list_agents(_DEFAULT_TENANT)
    if not agents:
        # First access against an empty store: seed the built-in agents.
        await _seed_builtin_agents(session)
        agents = await repo.list_agents(_DEFAULT_TENANT)
    return agents


@router.get("/agents/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str, session: AsyncSession = Depends(get_db)):
    """Fetch details for specific agent by ID."""
    repo = AgentsRepository(session)
    agent = await repo.get_agent(agent_id)
    if agent is None and agent_id in _BUILTIN_AGENT_IDS:
        await _seed_builtin_agents(session)
        agent = await repo.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} not found")
    return agent


@router.get("/agents/{agent_id}/baseline", response_model=AgentBaseline)
async def get_agent_baseline(agent_id: str, session: AsyncSession = Depends(get_db)):
    """Fetch learned baseline for agent."""
    repo = AgentsRepository(session)
    baseline = await repo.get_baseline(agent_id)
    if not baseline:
        return AgentBaseline(
            agent_id=agent_id,
            tool_frequency={},
            common_file_paths=[],
            avg_session_duration=0.0,
        )
    return baseline


@router.post("/agents/{agent_id}/baseline", response_model=AgentBaseline, status_code=status.HTTP_201_CREATED)
async def create_or_update_agent_baseline(
    agent_id: str,
    payload: AgentBaseline,
    session: AsyncSession = Depends(get_db),
):
    """Create or update behavioral baseline for agent."""
    payload.agent_id = agent_id
    repo = AgentsRepository(session)
    return await repo.upsert_baseline(agent_id, payload)
