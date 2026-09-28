"""Unit tests for ResearchAgent — Threat intelligence ingestion & HMAC handoff."""

from __future__ import annotations

import pytest

from src.agents.research_agent import (
    NIST_THREAT_CATALOG,
    ResearchAgent,
    ThreatIntelligenceRecord,
)
from src.core.hmac_handoff import verify_handoff
from src.models import AttackCategory, Severity


def test_research_agent_loads_nist_patterns():
    agent = ResearchAgent()
    findings = agent.gather_threat_intel(sources=["NIST_AI_RMF"])
    assert len(findings) >= len(NIST_THREAT_CATALOG)
    assert all(f.source == "NIST_AI_RMF" for f in findings)

    # Verify specific NIST AI RMF framework IDs exist
    framework_ids = {f.framework_id for f in findings}
    assert "NIST-MAP-1.5" in framework_ids
    assert "NIST-MAP-2.3" in framework_ids
    assert "NIST-MEASURE-2.2" in framework_ids
    assert "NIST-MEASURE-2.7" in framework_ids
    assert "NIST-MANAGE-1.3" in framework_ids
    assert "NIST-MANAGE-2.4" in framework_ids


def test_research_agent_loads_owasp_asi01_asi10():
    agent = ResearchAgent()
    findings = agent.gather_threat_intel(sources=["OWASP_ASI"])
    framework_ids = {f.framework_id for f in findings}

    for i in range(1, 11):
        code = f"ASI{i:02d}"
        assert code in framework_ids, f"{code} must be in the OWASP ASI catalog"

    # Spot-check specific ASI entries
    asi01 = next(f for f in findings if f.framework_id == "ASI01")
    assert asi01.category == AttackCategory.PROMPT_INJECTION
    assert len(asi01.suggested_vectors) > 0

    asi02 = next(f for f in findings if f.framework_id == "ASI02")
    assert asi02.category == AttackCategory.TOOL_ABUSE
    assert "tool:bash" in asi02.prerequisites or "tool:exec" in asi02.prerequisites

    asi05 = next(f for f in findings if f.framework_id == "ASI05")
    assert "tool:database" in asi05.prerequisites or "tool:sql" in asi05.prerequisites


def test_research_agent_loads_vulnerability_disclosures():
    agent = ResearchAgent()
    findings = agent.gather_threat_intel(sources=["VULNERABILITY_DISCLOSURE"])
    framework_ids = {f.framework_id for f in findings}

    assert "CVE-2024-5184" in framework_ids
    assert "CVE-2024-28184" in framework_ids
    assert "CVE-2024-34064" in framework_ids
    assert "ADV-2024-001" in framework_ids
    assert "ADV-2024-002" in framework_ids
    assert "ADV-2024-003" in framework_ids


def test_research_agent_filter_by_category_and_query():
    agent = ResearchAgent()
    pi_findings = agent.gather_threat_intel(focus_categories=[AttackCategory.PROMPT_INJECTION])
    assert len(pi_findings) > 0
    assert all(f.category == AttackCategory.PROMPT_INJECTION for f in pi_findings)

    sql_findings = agent.gather_threat_intel(query="SQL")
    assert len(sql_findings) > 0
    assert any("sql" in f.title.lower() or "sql" in f.description.lower() for f in sql_findings)


def test_research_agent_custom_disclosure_ingestion():
    agent = ResearchAgent()
    custom = [
        {
            "framework_id": "ZERO-DAY-2026-001",
            "category": "DPI",
            "title": "Zero-Day Memory Drift",
            "description": "Novel vector manipulating session context headers.",
            "technical_details": "Injecting surrogate pair delimiters across chunk boundaries.",
            "prerequisites": [],
            "suggested_vectors": ["Exploit context surrogate chunk"],
            "severity": "CRITICAL",
        }
    ]
    ingested = agent.ingest_custom_disclosures(custom)
    assert len(ingested) == 1
    assert isinstance(ingested[0], ThreatIntelligenceRecord)
    assert ingested[0].framework_id == "ZERO-DAY-2026-001"

    results = agent.gather_threat_intel(query="ZERO-DAY-2026-001")
    assert len(results) == 1
    assert results[0].framework_id == "ZERO-DAY-2026-001"


def test_research_agent_sign_handoff_envelope():
    agent = ResearchAgent()
    findings = agent.gather_threat_intel(focus_categories=[AttackCategory.PROMPT_INJECTION])
    envelope = agent.sign_handoff_envelope(findings, campaign_id="camp-res-1", round_id=1)

    assert envelope["sender"] == "research"
    assert envelope["receiver"] == "curator"
    assert envelope["campaign_id"] == "camp-res-1"
    assert envelope["signature"] != ""
    assert "threat_intel" in envelope["body"]
    assert len(envelope["body"]["threat_intel"]) == len(findings)

    # Cryptographically verify the signed envelope
    verified = verify_handoff(envelope, expected_sender="research", expected_receiver="curator")
    assert verified.sender == "research"
    assert verified.receiver == "curator"
