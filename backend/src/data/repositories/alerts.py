"""Repository for persistent alert and webhook-rule storage."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.models.alerts import Alert, AlertRule
from src.data.orm import AlertORM, AlertRuleORM
from src.data.repositories.base import BaseRepository


class AlertRepository(BaseRepository[AlertORM]):
    """Repository for persistent alert storage."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, AlertORM)

    def _to_domain(self, row: AlertORM) -> Alert:
        return Alert(
            id=uuid.UUID(str(row.id)),
            session_id=uuid.UUID(str(row.session_id)),
            agent_id=row.agent_id,
            severity=row.severity,
            title=row.title,
            message=row.message,
            risk_score=row.risk_score or 70.0,
            channel=row.channel,
            triggered_at=row.triggered_at,
            delivered=bool(row.delivered),
            tenant_id=row.tenant_id or "default_tenant",
        )

    def _to_orm(self, alert: Alert) -> AlertORM:
        return AlertORM(
            id=str(alert.id),
            session_id=str(alert.session_id),
            agent_id=alert.agent_id,
            severity=alert.severity,
            title=alert.title,
            message=alert.message,
            risk_score=alert.risk_score,
            channel=alert.channel,
            triggered_at=alert.triggered_at,
            delivered=alert.delivered,
            tenant_id=alert.tenant_id or "default_tenant",
        )

    async def create_alert(self, alert: Alert, *, commit: bool = True) -> Alert:
        if settings.is_testing:
            return alert
        self.session.add(self._to_orm(alert))
        if commit:
            await self.session.commit()
        return alert

    async def list_alerts(
        self,
        severity: str | None = None,
        session_id: str | None = None,
        tenant_id: str | None = None,
        limit: int = 500,
    ) -> list[Alert]:
        if settings.is_testing:
            return []
        query = select(AlertORM)
        if severity:
            query = query.where(AlertORM.severity == severity.upper())
        if session_id:
            query = query.where(AlertORM.session_id == session_id)
        if tenant_id:
            query = query.where(AlertORM.tenant_id == tenant_id)
        query = query.order_by(AlertORM.triggered_at.desc()).limit(limit)
        result = await self.session.execute(query)
        return [self._to_domain(row) for row in result.scalars().all()]

    async def mark_delivered(self, alert_id: uuid.UUID) -> None:
        if settings.is_testing:
            return
        result = await self.session.execute(
            select(AlertORM).where(AlertORM.id == str(alert_id))
        )
        row = result.scalar_one_or_none()
        if row is None:
            return
        row.delivered = True
        await self.session.commit()


class AlertRuleRepository(BaseRepository[AlertRuleORM]):
    """Repository for persistent webhook-rule storage."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, AlertRuleORM)

    def _to_domain(self, row: AlertRuleORM) -> AlertRule:
        return AlertRule(
            id=row.id,
            tenant_id=row.tenant_id,
            risk_threshold=row.risk_threshold,
            channel=row.channel,
            target_url=row.target_url,
            enabled=bool(row.enabled),
        )

    def _to_orm(self, rule: AlertRule) -> AlertRuleORM:
        return AlertRuleORM(
            id=rule.id,
            tenant_id=rule.tenant_id,
            risk_threshold=rule.risk_threshold,
            channel=rule.channel,
            target_url=rule.target_url,
            enabled=rule.enabled,
        )

    async def list_rules(self) -> list[AlertRule]:
        result = await self.session.execute(
            select(AlertRuleORM).order_by(AlertRuleORM.risk_threshold)
        )
        return [self._to_domain(row) for row in result.scalars().all()]

    async def upsert_rule(self, rule: AlertRule) -> AlertRule:
        result = await self.session.execute(
            select(AlertRuleORM).where(AlertRuleORM.id == rule.id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            self.session.add(self._to_orm(rule))
        else:
            row.risk_threshold = rule.risk_threshold
            row.channel = rule.channel
            row.target_url = rule.target_url
            row.enabled = rule.enabled
            row.tenant_id = rule.tenant_id
            row.config = rule.config
        await self.session.commit()
        return rule


# Re-export for import convenience.
__all__ = ["AlertRepository", "AlertRuleRepository"]
