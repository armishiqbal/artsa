"""Integration test: Full Six-agent chain end-to-end verification.

Chain: Research → Curator → Red Team → Target → Judge → Defender
Verifies the complete 6-agent loop with cryptographic HMAC handoffs between all peers.
"""

from __future__ import annotations

from pathlib import Path
import pytest
import yaml

from src.agents.curator_agent import CuratorAgent
from src.agents.defender_agent import DefenderAgent
from src.agents.judge_agent import JudgeAgent
from src.agents.red_team_agent import RedTeamAgent
from src.agents.research_agent import ResearchAgent
from src.agents.target_agent import TargetAgent
from src.agents.handoff_worker import (
    run_curator_hop,
    run_defender_hop,
    run_judge_hop,
    run_red_team_hop,
    run_research_hop,
    run_target_hop,
)
from src.core.hmac_handoff import sign_handoff
from src.data.attack_library import AttackLibrary
from src.models import (
    AttackCategory,
    AttackProfile,
    GuardrailConfig,
    RAGConfig,
    TargetConfig,
)


@pytest.fixture
def mock_policy_file(tmp_path: Path) -> Path:
    p = tmp_path / "default.yaml"
    initial_rule = {
        "name": "baseline_rule",
        "pattern": r"(?i)\bdrop\s+database\b",
        "event_type": "SQL_INJECTION",
        "severity": "CRITICAL",
        "risk_score": 95.0,
        "description": "Block SQL DROP",
    }
    with p.open("w", encoding="utf-8") as f:
        yaml.dump({"rules": [initial_rule]}, f)
    return p


def test_full_six_agent_chain_execution(tmp_path: Path, mock_policy_file: Path):
    campaign_id = "camp-six-agent-test"
    round_id = 1

    # 1. Configure Target
    target_config = TargetConfig(
        provider="deterministic",
        model="mock-model",
        tools=["search_web", "read_file"],  # No database tool
        rag=RAGConfig(enabled=False),
        guardrails=GuardrailConfig(input_content_filter=True, input_injection_detector=True),
    )

    attack_lib_dir = tmp_path / "attack_library"
    attack_lib_dir.mkdir(parents=True, exist_ok=True)
    attack_lib = AttackLibrary(library_dir=str(attack_lib_dir))

    # Initialize all agents
    research_agent = ResearchAgent()
    curator_agent = CuratorAgent()
    red_team_agent = RedTeamAgent(
        config={"provider": "deterministic", "use_llm": False},
        attack_profile=AttackProfile(categories=[AttackCategory.PROMPT_INJECTION]),
        attack_library=attack_lib,
        target_config=target_config,
    )
    target_agent = TargetAgent(target_config)
    judge_agent = JudgeAgent(config={"use_llm": False})
    defender_agent = DefenderAgent(
        config={"policy_path": str(mock_policy_file), "dry_run": False}
    )

    # ─── Hop 1: Research Hop ──────────────────────────────────────────────────
    init_envelope = sign_handoff(
        sender="defender",
        receiver="research",
        body={"status": "START_CAMPAIGN", "round": round_id},
        campaign_id=campaign_id,
        round_id=round_id,
    )
    res_result = run_research_hop(
        init_envelope,
        agent=research_agent,
        campaign_id=campaign_id,
        round_id=round_id,
    )
    assert res_result["ok"] is True
    assert len(res_result["threat_intel"]) > 0
    assert res_result["hmac_meta"]["hmac_verified"] is True
    curator_envelope = res_result["curator_envelope"]

    # ─── Hop 2: Curator Hop ───────────────────────────────────────────────────
    cur_result = run_curator_hop(
        curator_envelope,
        agent=curator_agent,
        target_surface=target_config,
        attack_library=attack_lib,
    )
    assert cur_result["ok"] is True
    assert len(cur_result["attack_seeds"]) > 0
    assert cur_result["hmac_meta"]["hmac_verified"] is True
    assert cur_result["hmac_meta"]["sender"] == "research"
    assert cur_result["hmac_meta"]["receiver"] == "curator"
    red_team_envelope = cur_result["red_team_envelope"]

    # ─── Hop 3: Red Team Hop ──────────────────────────────────────────────────
    rt_result = run_red_team_hop(
        red_team_envelope,
        agent=red_team_agent,
    )
    assert rt_result["ok"] is True
    assert rt_result["hmac_meta"]["hmac_verified"] is True
    assert rt_result["hmac_meta"]["sender"] == "curator"
    assert rt_result["hmac_meta"]["receiver"] == "red_team"

    # Red Team generates attack payload from curated seeds
    attack_payload = red_team_agent.generate_attack(AttackCategory.PROMPT_INJECTION)
    assert attack_payload.prompt is not None
    assert "{target_objective}" not in attack_payload.prompt
    assert "{{target_objective}}" not in attack_payload.prompt

    # Red Team signs for Target
    target_envelope = sign_handoff(
        sender="red_team",
        receiver="target",
        body=attack_payload.model_dump(mode="json"),
        campaign_id=campaign_id,
        round_id=round_id,
    )

    # ─── Hop 4: Target Hop ────────────────────────────────────────────────────
    target_result = run_target_hop(
        target_envelope,
        agent=target_agent,
    )
    assert target_result["ok"] is True
    assert target_result["hmac_meta"]["hmac_verified"] is True
    assert target_result["hmac_meta"]["sender"] == "red_team"
    assert target_result["hmac_meta"]["receiver"] == "target"
    judge_envelope = target_result["judge_envelope"]

    # ─── Hop 5: Judge Hop ─────────────────────────────────────────────────────
    judge_result = run_judge_hop(
        judge_envelope,
        agent=judge_agent,
    )
    assert judge_result["ok"] is True
    assert judge_result["hmac_meta"]["hmac_verified"] is True
    assert judge_result["hmac_meta"]["sender"] == "target"
    assert judge_result["hmac_meta"]["receiver"] == "judge"

    # Judge signs for Defender
    defender_envelope = sign_handoff(
        sender="judge",
        receiver="defender",
        body={
            "attack": judge_result["payload"],
            "response": judge_result["response"],
            "score": judge_result["score"],
        },
        campaign_id=campaign_id,
        round_id=round_id,
    )

    # ─── Hop 6: Defender Hop ──────────────────────────────────────────────────
    defender_result = run_defender_hop(
        defender_envelope,
        agent=defender_agent,
    )
    assert defender_result["ok"] is True
    assert defender_result["hmac_meta"]["hmac_verified"] is True
    assert defender_result["hmac_meta"]["sender"] == "judge"
    assert defender_result["hmac_meta"]["receiver"] == "defender"
    assert "defender_result" in defender_result
