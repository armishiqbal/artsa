"""Tests for Executive Compliance & Cryptographic Audit Export (NIST AI RMF, OWASP ASI, HMAC proofs)."""

import pytest
from httpx import ASGITransport, AsyncClient
from src.api.main import app
from tests.conftest import unwrap_response


@pytest.mark.asyncio
async def test_compliance_frameworks():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.get("/api/v1/compliance/frameworks")
        assert res.status_code == 200
        data = unwrap_response(res)
        frameworks = data["frameworks"]
        codes = [f["code"] for f in frameworks]

        assert "OWASP_AGENTIC_TOP10" in codes
        assert "NIST_AI_RMF" in codes
        assert "OWASP_LLM_TOP10" in codes
        assert "EU_AI_ACT" in codes
        assert "ISO_42001" in codes

        asi = next(f for f in frameworks if f["code"] == "OWASP_AGENTIC_TOP10")
        assert len(asi["items"]) == 10
        assert any("ASI01" in item for item in asi["items"])
        assert any("ASI07" in item for item in asi["items"])


@pytest.mark.asyncio
async def test_compliance_export_json():
    summary_payload = {
        "campaign_id": "c-exec-test-101",
        "model": "gpt-5.6-terra",
        "provider": "openai",
        "avg_attack_success": 4.1,
        "avg_bypass_depth": 1.5,
        "total_rounds": 10,
        "results_by_verdict": {"BLOCKED": 8, "BREACHED": 2},
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.post("/api/v1/compliance/export?format=json", json=summary_payload)
        assert res.status_code == 200
        data = unwrap_response(res)

        # Structure checks
        assert data["artifact_type"] == "ARTSA_EXECUTIVE_COMPLIANCE_AUDIT"
        assert data["campaign"]["id"] == "c-exec-test-101"

        # HMAC proofs
        hmac_proofs = data["hmac_cryptographic_proofs"]
        assert hmac_proofs["algorithm"] == "HMAC-SHA256"
        assert "merkle_root_hash" in hmac_proofs
        assert len(hmac_proofs["merkle_root_hash"]) == 64
        assert hmac_proofs["non_repudiation_status"] == "CRYPTOGRAPHICALLY_VERIFIED"
        assert hmac_proofs["total_signed_hops"] > 0

        # OWASP Agentic Top 10
        asi = data["owasp_agentic_top10"]
        assert len(asi["rows"]) == 10
        assert asi["compliance_score"] >= 80.0
        assert asi["summary"]["compliant"] > 0

        # NIST AI RMF Scorecard
        nist = data["nist_ai_rmf_scorecard"]
        assert len(nist["functions"]) == 4
        assert nist["composite_score"] >= 80.0

        # Adaptive Defense Lift
        lift = data["adaptive_defense_lift"]
        assert lift["adaptive_defense_detection_rate"] == 80.0
        assert lift["adaptive_lift_percent"] > 0
        assert "hot_patches_applied" in lift


@pytest.mark.asyncio
async def test_compliance_export_pdf():
    summary_payload = {
        "campaign_id": "c-exec-pdf-202",
        "model": "gpt-5.6-terra",
        "provider": "openai",
        "avg_attack_success": 3.8,
        "avg_bypass_depth": 1.2,
        "total_rounds": 12,
        "results_by_verdict": {"BLOCKED": 11, "BREACHED": 1},
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.post("/api/v1/compliance/export?format=pdf", json=summary_payload)
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert "artsa-compliance-c-exec-pdf-202.pdf" in res.headers["content-disposition"]
        assert res.content.startswith(b"%PDF-")
        assert len(res.content) > 3000


@pytest.mark.asyncio
async def test_compliance_export_markdown():
    summary_payload = {
        "campaign_id": "c-exec-md-303",
        "model": "gpt-5.6-terra",
        "provider": "openai",
        "avg_attack_success": 2.5,
        "avg_bypass_depth": 1.0,
        "total_rounds": 8,
        "results_by_verdict": {"BLOCKED": 8},
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        res = await client.post("/api/v1/compliance/export?format=markdown", json=summary_payload)
        assert res.status_code == 200
        data = unwrap_response(res)
        report_md = data["report_markdown"]
        assert "EXECUTIVE COMPLIANCE AUDIT REPORT" in report_md
        assert "HMAC-SHA256" in report_md
        assert "ASI01" in report_md
        assert "NIST AI Risk Management Framework" in report_md


@pytest.mark.asyncio
async def test_get_compliance_report_export_pdf_and_json():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Test PDF retrieval via GET
        res_pdf = await client.get("/api/v1/compliance/report/export?campaign_id=c-get-test&format=pdf")
        assert res_pdf.status_code == 200
        assert res_pdf.headers["content-type"] == "application/pdf"
        assert res_pdf.content.startswith(b"%PDF-")

        # Test JSON retrieval via GET
        res_json = await client.get("/api/v1/compliance/report/export?campaign_id=c-get-test&format=json")
        assert res_json.status_code == 200
        data = unwrap_response(res_json)
        assert data["campaign"]["id"] == "c-get-test"
        assert "hmac_cryptographic_proofs" in data
