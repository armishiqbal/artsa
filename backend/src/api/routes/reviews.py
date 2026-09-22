"""Operator-reviewed detection outcomes for live precision/recall evidence."""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_tenant
from src.data.db import get_async_session
from src.data.orm import HumanReviewORM

router = APIRouter(tags=["Human Reviews"])

ReviewClassification = Literal[
    "true_positive", "false_positive", "false_negative", "true_negative", "inconclusive"
]
ReviewSource = Literal["event", "finding", "external"]


class HumanReviewRequest(BaseModel):
    """A bounded, non-sensitive operator label for one observed case."""

    model_config = ConfigDict(extra="forbid")

    source_type: ReviewSource
    source_ref: str = Field(min_length=1, max_length=255)
    classification: ReviewClassification
    machine_verdict: str | None = Field(default=None, max_length=32)
    reason_code: str | None = Field(default=None, max_length=64)


def _review_view(row: HumanReviewORM) -> dict[str, object]:
    return {
        "id": row.id,
        "source_type": row.source_type,
        "source_ref": row.source_ref,
        "classification": row.classification,
        "machine_verdict": row.machine_verdict,
        "reason_code": row.reason_code,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.post("/reviews", status_code=201)
async def record_human_review(
    payload: HumanReviewRequest,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant),
) -> dict[str, object]:
    """Create or correct the current operator label for one source reference."""
    row = (
        await session.execute(
            select(HumanReviewORM).where(
                HumanReviewORM.tenant_id == tenant_id,
                HumanReviewORM.source_type == payload.source_type,
                HumanReviewORM.source_ref == payload.source_ref,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        row = HumanReviewORM(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            source_type=payload.source_type,
            source_ref=payload.source_ref,
            classification=payload.classification,
            machine_verdict=payload.machine_verdict,
            reason_code=payload.reason_code,
        )
        session.add(row)
    else:
        row.classification = payload.classification
        row.machine_verdict = payload.machine_verdict
        row.reason_code = payload.reason_code
    await session.commit()
    await session.refresh(row)
    return {"review": _review_view(row)}


@router.get("/reviews")
async def list_human_reviews(
    limit: int = 50,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant),
) -> dict[str, object]:
    """List a tenant's latest bounded labels; no raw event content is exposed."""
    safe_limit = max(1, min(limit, 100))
    rows = (
        await session.execute(
            select(HumanReviewORM)
            .where(HumanReviewORM.tenant_id == tenant_id)
            .order_by(HumanReviewORM.updated_at.desc())
            .limit(safe_limit)
        )
    ).scalars().all()
    return {"reviews": [_review_view(row) for row in rows], "total": len(rows)}


@router.get("/reviews/metrics")
async def human_review_metrics(
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant),
) -> dict[str, object]:
    """Compute production-quality metrics from human labels only."""
    rows = (
        await session.execute(
            select(HumanReviewORM.classification).where(HumanReviewORM.tenant_id == tenant_id)
        )
    ).scalars().all()
    counts = {key: 0 for key in ("true_positive", "false_positive", "false_negative", "true_negative", "inconclusive")}
    for label in rows:
        if label in counts:
            counts[label] += 1
    tp, fp, fn, tn = (counts[key] for key in ("true_positive", "false_positive", "false_negative", "true_negative"))

    def rate(numerator: int, denominator: int) -> float | None:
        return round(100 * numerator / denominator, 1) if denominator else None

    return {
        "basis": "human_review",
        "reviewed_cases": tp + fp + fn + tn,
        **counts,
        "precision": rate(tp, tp + fp),
        "recall": rate(tp, tp + fn),
        "false_positive_rate": rate(fp, fp + tn),
        "false_negative_rate": rate(fn, fn + tp),
    }
