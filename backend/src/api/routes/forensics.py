"""Forensics and compliance export routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query, Response
from pydantic import BaseModel, Field

router = APIRouter(tags=["Forensics"])


class ForensicsRequest(BaseModel):
    events: list[dict[str, Any]] = Field(default_factory=list)
    session_id: str | None = None


@router.post("/forensics/analyze")
async def analyze_trajectory_forensics(payload: ForensicsRequest) -> dict[str, Any]:
    from src.reporting.local_forensics import LocalForensicAnalyzer

    analyzer = LocalForensicAnalyzer()
    result = analyzer.analyze_trajectory_logs(payload.events)
    return result.model_dump()


@router.get("/compliance/frameworks")
async def compliance_frameworks() -> dict[str, Any]:
    """List the governance frameworks covered by the compliance exporter."""
    from src.reporting.compliance_exporter import ISO_42001_CLAUSES, OWASP_LLM_TOP10

    return {
        "frameworks": [
            {
                "code": "OWASP_LLM_TOP10",
                "name": "OWASP Top 10 for LLM Applications (2025)",
                "items": [f"{r['id']} {r['name']}" for r in OWASP_LLM_TOP10],
            },
            {
                "code": "EU_AI_ACT",
                "name": "EU AI Act — Article 15 (Cybersecurity & Robustness)",
                "items": ["Article 15 High-Risk AI robustness requirements"],
            },
            {
                "code": "NIST_AI_RMF",
                "name": "NIST AI Risk Management Framework (1.0)",
                "items": ["GOVERN 1.2", "MEASURE 2.6", "MANAGE 2.2"],
            },
            {
                "code": "ISO_42001",
                "name": "ISO/IEC 42001:2023 — AI Management System",
                "items": [f"Clause {c['id']} {c['name']}" for c in ISO_42001_CLAUSES],
            },
        ]
    }


@router.post("/compliance/export")
async def export_compliance_report(
    summary: dict[str, Any],
    format: str = Query("markdown", pattern="^(markdown|json|pdf)$"),
) -> Any:
    from src.reporting.compliance_exporter import ComplianceReportExporter

    exporter = ComplianceReportExporter(summary)
    if format == "json":
        return exporter.export_json()
    if format == "pdf":
        pdf_bytes = exporter.export_pdf()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="artsa-compliance-{exporter.campaign_id}.pdf"'
            },
        )
    return {
        "cvss_v4": exporter.calculate_cvss_v4(),
        "eu_ai_act": exporter.generate_eu_ai_act_article_15_audit(),
        "nist_ai_rmf": exporter.generate_nist_ai_rmf_audit(),
        "owasp_llm_top10": exporter.generate_owasp_llm_top10(),
        "iso_42001": exporter.generate_iso_42001(),
        "report_markdown": exporter.export_markdown_audit_report(),
    }
