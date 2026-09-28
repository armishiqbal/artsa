"""Unit tests for ResearchAgent Live Threat Feeds Ingestion (NVD + MITRE ATLAS) and API endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from src.agents.research_agent import ResearchAgent, ThreatIntelligenceRecord
from src.api.main import app
from src.models import AttackCategory
from tests.conftest import unwrap_response

client = TestClient(app)


def test_research_agent_mitre_atlas_feed():
    agent = ResearchAgent()
    records = agent.fetch_live_mitre_atlas_feed()
    assert len(records) >= 5

    framework_ids = {r.framework_id for r in records}
    assert "AML.T0051" in framework_ids
    assert "AML.T0054" in framework_ids
    assert "AML.T0053" in framework_ids
    assert "AML.T0057" in framework_ids

    prompt_inj = next(r for r in records if r.framework_id == "AML.T0051")
    assert prompt_inj.source == "MITRE_ATLAS"
    assert prompt_inj.category == AttackCategory.PROMPT_INJECTION
    assert "mitre_atlas" in prompt_inj.tags


def test_research_agent_nvd_feed_resilience():
    agent = ResearchAgent()
    # Should complete without error even if offline/sandboxed
    records = agent.fetch_live_nvd_feed(query="agent prompt injection", limit=5)
    assert len(records) > 0
    assert all(r.source == "NVD_LIVE" for r in records)
    assert all(r.framework_id.startswith("CVE") for r in records)


def test_research_agent_sync_live_feeds():
    agent = ResearchAgent()
    result = agent.sync_live_feeds(nvd_query="LLM agent", limit=5)
    assert result["status"] == "success"
    assert result["nvd_count"] > 0
    assert result["mitre_atlas_count"] >= 5
    assert result["total_ingested"] == result["nvd_count"] + result["mitre_atlas_count"]


def test_api_list_research_threats():
    headers = {"X-Tenant-ID": "test-research-tenant"}
    res = client.get("/api/v1/research/threats", headers=headers)
    assert res.status_code == 200
    data = unwrap_response(res)
    assert data["count"] > 20
    assert "threats" in data

    # Filter by source: NIST_AI_RMF
    res_nist = client.get("/api/v1/research/threats?source=NIST_AI_RMF", headers=headers)
    assert res_nist.status_code == 200
    data_nist = unwrap_response(res_nist)
    assert all(t["source"] == "NIST_AI_RMF" for t in data_nist["threats"])

    # Filter by source: MITRE_ATLAS
    res_atlas = client.get("/api/v1/research/threats?source=MITRE_ATLAS", headers=headers)
    assert res_atlas.status_code == 200
    data_atlas = unwrap_response(res_atlas)
    assert all(t["source"] == "MITRE_ATLAS" for t in data_atlas["threats"])


def test_api_sync_threat_feeds():
    headers = {"X-Tenant-ID": "test-research-tenant"}
    res = client.post(
        "/api/v1/research/sync",
        headers=headers,
        json={"query": "LLM agent", "limit": 5},
    )
    assert res.status_code == 200
    data = unwrap_response(res)
    assert data["status"] == "success"
    assert data["nvd_count"] > 0
    assert data["mitre_atlas_count"] >= 5


def test_api_framework_metrics():
    headers = {"X-Tenant-ID": "test-research-tenant"}
    res = client.get("/api/v1/research/frameworks", headers=headers)
    assert res.status_code == 200
    data = unwrap_response(res)
    assert data["total_threats"] > 20
    sources = data["sources"]
    assert "NIST_AI_RMF" in sources
    assert "OWASP_ASI" in sources
    assert "MITRE_ATLAS" in sources
