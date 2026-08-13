"""Agents Management and Baseline Endpoints."""


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_db
from src.core.models.agents import Agent, AgentBaseline
from src.data.repositories.agents import AgentsRepository

router = APIRouter(tags=["Agents"])

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
