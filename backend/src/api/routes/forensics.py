"""Forensics and compliance export routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

from src.api.dependencies import get_current_tenant

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
    from src.reporting.compliance_exporter import (
        ISO_42001_CLAUSES,
        OWASP_AGENTIC_TOP10,
        OWASP_LLM_TOP10,
    )

    return {
        "frameworks": [
            {
                "code": "OWASP_AGENTIC_TOP10",
                "name": "OWASP Top 10 for Agentic Applications (ASI01-ASI10)",
                "items": [f"{r['id']} {r['name']}" for r in OWASP_AGENTIC_TOP10],
            },
            {
                "code": "NIST_AI_RMF",
                "name": "NIST AI Risk Management Framework (1.0)",
                "items": ["GOVERN 1.1 / 1.2", "MAP 1.1 / 1.5", "MEASURE 2.6 / 2.7", "MANAGE 2.2 / 2.4"],
            },
            {
                "code": "OWASP_LLM_TOP10",
                "name": "OWASP Top 10 for LLM Applications (2025)",
                "items": [f"{r['id']} {r['name']}" for r in OWASP_LLM_TOP10],
            },
            {
                "code": "EU_AI_ACT",
                "name": "EU AI Act - Article 15 (Cybersecurity & Robustness)",
                "items": ["Article 15 High-Risk AI robustness requirements"],
            },
            {
                "code": "ISO_42001",
                "name": "ISO/IEC 42001:2023 - AI Management System",
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
        "nist_ai_rmf_scorecard": exporter.generate_nist_ai_rmf_scorecard(),
        "owasp_agentic_top10": exporter.generate_owasp_agentic_top10(),
        "owasp_llm_top10": exporter.generate_owasp_llm_top10(),
        "hmac_cryptographic_proofs": exporter.generate_hmac_audit_proofs(),
        "adaptive_defense_lift": exporter.generate_adaptive_lift_summary(),
        "iso_42001": exporter.generate_iso_42001(),
        "report_markdown": exporter.export_markdown_audit_report(),
    }


@router.get("/compliance/report/export")
async def get_compliance_report_export(
    campaign_id: str | None = None,
    format: str = Query("pdf", pattern="^(markdown|json|pdf)$"),
    tenant_id: str = Depends(get_current_tenant),
) -> Any:
    """Export a report for a campaign owned by the authenticated tenant."""
    from src.data.campaign_job_store import campaign_job_store
    from src.data.hmac_audit_store import recent_handoff_audits
    from src.reporting.compliance_exporter import ComplianceReportExporter

    if campaign_id:
        job = campaign_job_store.get(campaign_id, tenant_id=tenant_id)
        if not job:
            raise HTTPException(status_code=404, detail="Campaign report not found")
    else:
        jobs = campaign_job_store.list_jobs(limit=1, tenant_id=tenant_id)
        if not jobs:
            raise HTTPException(status_code=404, detail="No campaign report is available")
        job = jobs[0]

    summary = job.get("summary_json") or job.get("summary")
    if not isinstance(summary, dict):
        raise HTTPException(status_code=404, detail="Campaign has no completed report data")
    summary = dict(summary)
    summary["campaign_id"] = str(job.get("id") or campaign_id or "unknown")
    summary["model"] = job.get("model") or summary.get("model")
    summary["provider"] = job.get("provider") or summary.get("provider")
    requested_campaign_id = str(summary["campaign_id"])
    hmac_audit_records = [
        row
        for row in recent_handoff_audits(1000)
        if str(row.get("campaign_id")) == requested_campaign_id
        and str(row.get("tenant_id") or "default_org") == tenant_id
    ]

    exporter = ComplianceReportExporter(summary, hmac_audit_records=hmac_audit_records)
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
        "nist_ai_rmf_scorecard": exporter.generate_nist_ai_rmf_scorecard(),
        "owasp_agentic_top10": exporter.generate_owasp_agentic_top10(),
        "hmac_cryptographic_proofs": exporter.generate_hmac_audit_proofs(),
        "adaptive_defense_lift": exporter.generate_adaptive_lift_summary(),
        "iso_42001": exporter.generate_iso_42001(),
        "report_markdown": exporter.export_markdown_audit_report(),
    }


@router.post("/readiness/export")
async def export_readiness_report(
    report: dict[str, Any],
    format: str = Query("markdown", pattern="^(markdown|json|pdf)$"),
) -> Any:
    """Export Get Started validation suite as JSON, Markdown, or PDF."""
    from src.reporting.readiness_exporter import ReadinessReportExporter

    exporter = ReadinessReportExporter(report)
    if format == "json":
        return exporter.export_json()
    if format == "pdf":
        pdf_bytes = exporter.export_pdf()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="artsa-readiness-{int(exporter.readiness_pct)}pct.pdf"'
            },
        )
    return {"report_markdown": exporter.export_markdown()}
