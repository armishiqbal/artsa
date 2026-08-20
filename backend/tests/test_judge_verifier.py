"""WS-2.3: optional LLM-judge verifier for borderline verdicts."""

import uuid

import pytest
from src.core.config import settings
from src.core.models.events import ToolCallEvent
from src.core.models.scores import ContainmentVerdict, RiskScore
from src.services.judge import JudgeVerifier


def _event() -> ToolCallEvent:
    return ToolCallEvent(session_id=uuid.uuid4(), agent_id="t", tool_name="exec_command",
                         arguments={"command": "curl -s https://example.org/x"})


def _suspicious() -> tuple[RiskScore, ContainmentVerdict]:
    risk = RiskScore(session_id=uuid.uuid4(), overall_score=60.0, rule_based_score=60.0, flags=["EGRESS_TUNNEL"])
    verdict = ContainmentVerdict(
        session_id=risk.session_id, verdict="SUSPICIOUS", confidence=0.7,
        reasoning="engine borderline", recommended_action="QUARANTINE",
    )
    return risk, verdict


@pytest.fixture()
def judge(monkeypatch):
    j = JudgeVerifier()
    monkeypatch.setattr(j, "_call_judge", lambda tool, args: "MALICIOUS")
    return j


def test_disabled_by_default_is_noop(judge):
    risk, verdict = _suspicious()
    new_risk, new_verdict, evidence = judge.verify(_event(), risk, verdict)
    assert new_risk is risk and new_verdict is verdict and evidence is None


def test_judge_confirms_escalates_to_kill(monkeypatch, judge):
    monkeypatch.setattr(settings, "ARTSA_JUDGE_ENABLED", True)
    # Phase 4.6: escalation requires a calibrated judge; the raise is bounded
    # by ARTSA_JUDGE_MAX_RAISE (25) rather than forcing a fixed 88.
    monkeypatch.setattr("src.benchmark.judge_validation.judge_is_calibrated", lambda: True)
    risk, verdict = _suspicious()
    new_risk, new_verdict, evidence = judge.verify(_event(), risk, verdict)
    assert new_verdict.verdict == "BREACHED"
    assert new_verdict.recommended_action == "KILL"
    assert new_risk.overall_score == 85.0  # 60 + MAX_RAISE 25
    assert "JUDGE_CONFIRMED" in new_risk.flags
    assert evidence["judge_action"] == "escalated_to_kill"


def test_uncalibrated_judge_cannot_escalate(monkeypatch, judge):
    """Phase 4.6 power cap: without a persisted calibration record the judge is
    inert even when it answers MALICIOUS."""
    monkeypatch.setattr(settings, "ARTSA_JUDGE_ENABLED", True)
    monkeypatch.setattr("src.benchmark.judge_validation.judge_is_calibrated", lambda: False)
    risk, verdict = _suspicious()
    new_risk, new_verdict, evidence = judge.verify(_event(), risk, verdict)
    assert new_verdict.verdict == "SUSPICIOUS"
    assert new_risk.overall_score == 60.0
    assert evidence["judge_action"] == "judge_not_calibrated_no_escalation"


def test_judge_safe_never_downgrades(monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_JUDGE_ENABLED", True)
    j = JudgeVerifier()
    monkeypatch.setattr(j, "_call_judge", lambda tool, args: "SAFE")
    risk, verdict = _suspicious()
    new_risk, new_verdict, evidence = j.verify(_event(), risk, verdict)
    assert new_verdict.verdict == "SUSPICIOUS"  # never downgraded
    assert new_risk.overall_score == 60.0
    assert evidence["judge_action"] == "kept_engine_verdict"


def test_judge_error_is_fail_safe(monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_JUDGE_ENABLED", True)
    j = JudgeVerifier()

    def boom(tool, args):
        raise RuntimeError("llm down")

    monkeypatch.setattr(j, "_call_judge", boom)
    risk, verdict = _suspicious()
    _new_risk, new_verdict, evidence = j.verify(_event(), risk, verdict)
    assert new_verdict.verdict == "SUSPICIOUS"
    assert evidence is None


def test_non_borderline_verdict_not_queried(monkeypatch):
    monkeypatch.setattr(settings, "ARTSA_JUDGE_ENABLED", True)
    j = JudgeVerifier()
    monkeypatch.setattr(j, "_call_judge", lambda tool, args: (_ for _ in ()).throw(AssertionError("must not be called")))
    risk = RiskScore(session_id=uuid.uuid4(), overall_score=95.0, rule_based_score=95.0, flags=["X"])
    verdict = ContainmentVerdict(session_id=risk.session_id, verdict="BREACHED", confidence=0.99,
                                 reasoning="high", recommended_action="KILL")
    _new_risk, new_verdict, evidence = j.verify(_event(), risk, verdict)
    assert new_verdict is verdict and evidence is None


def test_event_processor_wires_judge(monkeypatch):
    """The hot path instantiates the judge lazily and stays a no-op when off."""
    from src.services.event_processor import EventProcessor

    processor = EventProcessor()
    risk, verdict, _secs = processor.process_event(_event())
    assert verdict.verdict in ("SAFE", "SUSPICIOUS", "BREACHED")
    assert isinstance(risk, RiskScore)
