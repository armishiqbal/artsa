"""Forensics and compliance export routes."""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(tags=["Forensics"])


class ForensicsRequest(BaseModel):
    events: List[Dict[str, Any]] = Field(default_factory=list)
    session_id: str | None = None


@router.post("/forensics/analyze")
async def analyze_trajectory_forensics(payload: ForensicsRequest) -> Dict[str, Any]:
    from src.reporting.local_forensics import LocalForensicAnalyzer

    analyzer = LocalForensicAnalyzer()
    result = analyzer.analyze_trajectory_logs(payload.events)
    return result.model_dump()


@router.post("/compliance/export")
async def export_compliance_report(summary: Dict[str, Any]) -> Dict[str, Any]:
    from src.reporting.compliance_exporter import ComplianceReportExporter

    exporter = ComplianceReportExporter(summary)
    return {
        "cvss_v4": exporter.calculate_cvss_v4(),
        "eu_ai_act": exporter.generate_eu_ai_act_article_15_audit(),
        "nist_ai_rmf": exporter.generate_nist_ai_rmf_audit(),
        "report_markdown": exporter.export_markdown_audit_report(),
    }
