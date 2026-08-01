"""Agents Route."""

from typing import List
from fastapi import APIRouter
from src.core.models.agents import Agent

router = APIRouter(tags=["Agents"])

_mock_agents = [
    Agent(id="agent-support-01", tenant_id="default_tenant", name="Customer Support Agent", status="HEALTHY", total_sessions=42, total_breaches=0),
    Agent(id="agent-sql-02", tenant_id="default_tenant", name="SQL Orchestrator Agent", status="AT_RISK", total_sessions=18, total_breaches=1),
    Agent(id="agent-exec-03", tenant_id="default_tenant", name="Admin Command Executor", status="QUARANTINED", total_sessions=5, total_breaches=3),
]


@router.get("/agents", response_model=List[Agent])
async def list_agents():
    """List registered AI agents and their containment status."""
    return _mock_agents
