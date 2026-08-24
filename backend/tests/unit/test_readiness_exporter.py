"""Tests for go-live readiness report exporter."""

import pytest

from src.reporting.readiness_exporter import ReadinessReportExporter

SAMPLE = {
    "generated_at": "2026-08-21T12:00:00Z",
    "readiness_pct": 85,
    "suite": [
        {
            "id": "prompt_injection",
            "label": "Trick the AI",
            "owasp": "LLM01",
            "atlas": "AML.T0051",
            "passed": True,
            "risk": 92,
            "verdict": "BREACHED",
        },
        {
            "id": "benign",
            "label": "Safe request",
            "owasp": "LLM02",
            "passed": False,
            "risk": 40,
            "verdict": "SUSPICIOUS",
        },
    ],
    "ingest_smoke_test": {
        "sessionId": "sess-1",
        "latencyMs": 42,
        "risk": 88,
        "verdict": "BREACHED",
        "action": "ALERT",
    },
}


def test_readiness_exporter_json():
    exporter = ReadinessReportExporter(SAMPLE)
    data = exporter.export_json()
    assert data["readiness_pct"] == 85
    assert data["suite_pass"] == 1
    assert data["sign_off_status"] == "READY FOR PRODUCTION"
    assert len(data["owasp_coverage"]) == 2


def test_readiness_exporter_markdown():
    exporter = ReadinessReportExporter(SAMPLE)
    md = exporter.export_markdown()
    assert "ARTSA Go-Live Readiness Report" in md
    assert "LLM01" in md
    assert "sess-1" in md


def test_readiness_exporter_pdf():
    fpdf = pytest.importorskip("fpdf")
    assert fpdf is not None
    exporter = ReadinessReportExporter(SAMPLE)
    pdf = exporter.export_pdf()
    assert pdf.startswith(b"%PDF")
