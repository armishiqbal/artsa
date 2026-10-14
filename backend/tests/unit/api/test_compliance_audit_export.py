"""Tests for Executive Compliance & Cryptographic Audit Export (NIST AI RMF, OWASP ASI, HMAC proofs)."""

import pytest
from httpx import ASGITransport, AsyncClient
from src.api.main import app
from src.data.campaign_job_store import campaign_job_store
from src.reporting.compliance_exporter import ComplianceReportExporter
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
        assert hmac_proofs["merkle_root_hash"] is None
        assert hmac_proofs["non_repudiation_status"] == "UNVERIFIED"
        assert hmac_proofs["total_signed_hops"] == 0

        # OWASP Agentic Top 10
        asi = data["owasp_agentic_top10"]
        assert len(asi["rows"]) == 10
        assert asi["compliance_score"] is None
        assert asi["summary"]["not_assessed"] == 10

        # NIST AI RMF Scorecard
        nist = data["nist_ai_rmf_scorecard"]
        assert len(nist["functions"]) == 4
        assert nist["composite_score"] is None
        assert all(row["status"] == "NOT_ASSESSED" for row in nist["functions"])

        # Adaptive Defense Lift
        lift = data["adaptive_defense_lift"]
        assert lift["adaptive_defense_detection_rate"] == 80.0
        assert lift["adaptive_lift_percent"] is None
        assert lift["static_baseline_detection_rate"] is None
        assert lift["hot_patches_applied"] is None


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
        assert b"VERIFIED AUTHENTIC" not in res.content
        assert b"mathematically attested" not in res.content


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
    campaign_id = "c-get-test"
    tenant_id = "compliance-test-tenant"
    campaign_job_store.create(
        campaign_id,
        name="Compliance export test",
        provider="test-provider",
        model="test-model",
        attack_profile="test",
        max_rounds=2,
        request_json={},
        tenant_id=tenant_id,
    )
    campaign_job_store.complete(
        campaign_id,
        {"total_rounds": 2, "results_by_verdict": {"BLOCKED": 1, "BREACHED": 1}},
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # Test PDF retrieval via GET
        res_pdf = await client.get(
            f"/api/v1/compliance/report/export?campaign_id={campaign_id}&format=pdf",
            headers={"X-Tenant-ID": tenant_id},
        )
        assert res_pdf.status_code == 200
        assert res_pdf.headers["content-type"] == "application/pdf"
        assert res_pdf.content.startswith(b"%PDF-")

        # Test JSON retrieval via GET
        res_json = await client.get(
            f"/api/v1/compliance/report/export?campaign_id={campaign_id}&format=json",
            headers={"X-Tenant-ID": tenant_id},
        )
        assert res_json.status_code == 200
        data = unwrap_response(res_json)
        assert data["campaign"]["id"] == campaign_id
        assert "hmac_cryptographic_proofs" in data
        assert data["hmac_cryptographic_proofs"]["non_repudiation_status"] == "UNVERIFIED"


@pytest.mark.asyncio
async def test_compliance_report_export_does_not_fabricate_missing_campaign():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(
            "/api/v1/compliance/report/export?campaign_id=missing-campaign&format=json",
            headers={"X-Tenant-ID": "compliance-test-tenant"},
        )
    assert response.status_code == 404


def test_hmac_proof_uses_supplied_verified_audit_rows():
    exporter = ComplianceReportExporter(
        {"campaign_id": "hmac-proof-test"},
        hmac_audit_records=[
            {
                "event_id": "event-1",
                "nonce_sha256": "a" * 64,
                "body_sha256": "b" * 64,
                "hmac_state": "ok",
                "signature_status": "verified",
                "replay_detected": False,
            }
        ],
    )
    proof = exporter.generate_hmac_audit_proofs()
    assert proof["non_repudiation_status"] == "CRYPTOGRAPHICALLY_VERIFIED"
    assert proof["verified_hops"] == 1
    assert len(proof["merkle_root_hash"]) == 64
