"""Agents Management and Baseline Endpoints."""

from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, status
from src.core.models.agents import Agent, AgentBaseline

router = APIRouter(tags=["Agents"])

_agents_db: Dict[str, Agent] = {
    "agent-support-01": Agent(id="agent-support-01", tenant_id="default_tenant", name="Customer Support Agent", status="HEALTHY", total_sessions=42, total_breaches=0),
    "agent-sql-02": Agent(id="agent-sql-02", tenant_id="default_tenant", name="SQL Orchestrator Agent", status="AT_RISK", total_sessions=18, total_breaches=1),
    "agent-exec-03": Agent(id="agent-exec-03", tenant_id="default_tenant", name="Admin Command Executor", status="QUARANTINED", total_sessions=5, total_breaches=3),
}

_baselines_db: Dict[str, AgentBaseline] = {
    "agent-support-01": AgentBaseline(
        agent_id="agent-support-01",
        tool_frequency={"search_docs": 0.8, "fetch_user_profile": 0.2},
        common_file_paths=["/docs/help.json"],
        avg_session_duration=120.5,
    )
}


@router.get("/agents", response_model=List[Agent])
async def list_agents():
    """List registered AI agents."""
    return list(_agents_db.values())


@router.get("/agents/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str):
    """Fetch details for specific agent by ID."""
    agent = _agents_db.get(agent_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} not found")
    return agent


@router.get("/agents/{agent_id}/baseline", response_model=AgentBaseline)
async def get_agent_baseline(agent_id: str):
    """Fetch learned baseline for agent."""
    baseline = _baselines_db.get(agent_id)
    if not baseline:
        return AgentBaseline(
            agent_id=agent_id,
            tool_frequency={},
            common_file_paths=[],
            avg_session_duration=0.0,
        )
    return baseline


@router.post("/agents/{agent_id}/baseline", response_model=AgentBaseline, status_code=status.HTTP_201_CREATED)
async def create_or_update_agent_baseline(agent_id: str, payload: AgentBaseline):
    """Create or update behavioral baseline for agent."""
    payload.agent_id = agent_id
    _baselines_db[agent_id] = payload
    return payload
