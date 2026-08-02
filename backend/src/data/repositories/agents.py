"""Repository for AI agent registration and behavioral baseline persistence."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.models.agents import Agent, AgentBaseline
from src.data.orm import AgentBaselineORM, AgentORM
from src.data.repositories.base import BaseRepository


class AgentsRepository(BaseRepository[AgentORM]):
    """Repository for AI agent registration and behavioral baseline persistence."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, AgentORM)

    def _to_domain(self, row: AgentORM) -> Agent:
        return Agent(
            id=row.id,
            tenant_id=row.tenant_id,
            name=row.name,
            status=row.status,
            last_seen=row.last_seen,
            total_sessions=row.total_sessions,
            total_breaches=row.total_breaches,
        )

    def _to_orm(self, agent: Agent) -> AgentORM:
        return AgentORM(
            id=agent.id,
            tenant_id=agent.tenant_id,
            name=agent.name,
            status=agent.status,
            last_seen=agent.last_seen,
            total_sessions=agent.total_sessions,
            total_breaches=agent.total_breaches,
        )

    async def upsert_agent(self, agent: Agent) -> Agent:
        """Insert a new agent registration or update an existing one in place."""
        result = await self.session.execute(select(AgentORM).where(AgentORM.id == agent.id))
        row = result.scalar_one_or_none()
        if row is None:
            self.session.add(self._to_orm(agent))
        else:
            row.tenant_id = agent.tenant_id
            row.name = agent.name
            row.status = agent.status
            row.last_seen = agent.last_seen
            row.total_sessions = agent.total_sessions
            row.total_breaches = agent.total_breaches
        await self.session.commit()
        return agent

    async def list_agents(self, tenant_id: str) -> List[Agent]:
        """List registered agents for a tenant, ordered by id for stable output."""
        result = await self.session.execute(
            select(AgentORM).where(AgentORM.tenant_id == tenant_id).order_by(AgentORM.id)
        )
        return [self._to_domain(row) for row in result.scalars().all()]

    async def get_agent(self, agent_id: str) -> Optional[Agent]:
        """Fetch a single agent by id, or None when not found."""
        result = await self.session.execute(select(AgentORM).where(AgentORM.id == agent_id))
        row = result.scalar_one_or_none()
        return self._to_domain(row) if row else None

    def _baseline_to_json(self, baseline: AgentBaseline) -> Dict[str, Any]:
        return {
            "tool_frequency": dict(baseline.tool_frequency),
            "common_file_paths": list(baseline.common_file_paths),
            "avg_session_duration": baseline.avg_session_duration,
        }

    def _to_baseline_domain(self, row: AgentBaselineORM) -> AgentBaseline:
        data = dict(row.baseline or {})
        return AgentBaseline(
            agent_id=row.agent_id,
            tool_frequency=dict(data.get("tool_frequency") or {}),
            common_file_paths=list(data.get("common_file_paths") or []),
            avg_session_duration=float(data.get("avg_session_duration", 0.0)),
            updated_at=row.updated_at or datetime.now(timezone.utc),
        )

    async def get_baseline(self, agent_id: str) -> Optional[AgentBaseline]:
        """Fetch the learned baseline for an agent, or None when absent."""
        result = await self.session.execute(
            select(AgentBaselineORM).where(AgentBaselineORM.agent_id == agent_id)
        )
        row = result.scalar_one_or_none()
        return self._to_baseline_domain(row) if row else None

    async def upsert_baseline(self, agent_id: str, baseline: AgentBaseline) -> AgentBaseline:
        """Create or update the behavioral baseline for an agent."""
        result = await self.session.execute(
            select(AgentBaselineORM).where(AgentBaselineORM.agent_id == agent_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = AgentBaselineORM(agent_id=agent_id, baseline=self._baseline_to_json(baseline))
            self.session.add(row)
        else:
            row.baseline = self._baseline_to_json(baseline)
        await self.session.commit()
        await self.session.refresh(row)
        return self._to_baseline_domain(row)
