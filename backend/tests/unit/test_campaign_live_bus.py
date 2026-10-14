"""Campaign live bus — emit + history for Live Monitor."""

from src.models import HopLatencyMs
from src.services.campaign_live_bus import (
    campaign_live_bus,
    default_agents,
    emit_campaign_status,
    emit_round_events,
    verdict_to_outcome,
)


class _Cat:
    value = "DPI"


class _Attack:
    id = "atk-live-1"
    name = "Delimiter Confusion"
    category = _Cat()


class _Resp:
    response = "blocked output"
    raw_response = ""
    blocked = True


class _Verdict:
    value = "BLOCKED"


class _Score:
    verdict = _Verdict()


class _Round:
    round_number = 1
    attack = _Attack()
    response = _Resp()
    score = _Score()
    hop_latency_ms = HopLatencyMs(red_team=11.0, target=22.0, judge=33.0)


def test_verdict_to_outcome():
    assert verdict_to_outcome("BLOCKED") == "pass"
    assert verdict_to_outcome("SUCCESS") == "fail"
    assert verdict_to_outcome("PARTIAL") == "flag"


def test_emit_round_events_three_lines(tmp_path):
    cid = "test-campaign-live-1"
    # isolate history
    campaign_live_bus._history[cid].clear()
    events = emit_round_events(cid, _Round())
    assert len(events) == 3
    assert [e["kind"] for e in events] == ["attack", "response", "verdict"]
    assert events[2]["outcome"] == "pass"
    assert "Red Team → Target" in events[0]["summary"]
    hist = campaign_live_bus.history(cid)
    assert len(hist) >= 3


def test_emit_round_events_truthful_hops_and_hmac():
    cid = "test-campaign-live-hops"
    campaign_live_bus._history[cid].clear()
    events = emit_round_events(cid, _Round())

    assert [e["actor"] for e in events] == ["red_team", "target", "judge"]
    assert [e["hop"]["agent"] for e in events] == ["red_team", "target", "judge"]
    assert all(e["hop"]["status"] == "executed" for e in events)
    # The stage ran, but this fixture has no receiver-verified HMAC evidence.
    assert all(e["hop"]["hmac_state"] == "unwired" for e in events)
    assert all(e["hop"]["hmac_verified"] is None for e in events)
    assert events[0]["hop"]["latency_ms"] == 11.0
    assert events[1]["hop"]["latency_ms"] == 22.0
    assert events[2]["hop"]["latency_ms"] == 33.0
    assert events[2]["hop"]["verdict"] == "BLOCKED"

    idle = {"defender"}
    for event in events:
        by_agent = {row["agent"]: row for row in event["chain"]}
        assert by_agent["research"]["status"] == "executed"
        assert by_agent["curator"]["status"] == "executed"
        for name in idle:
            assert by_agent[name]["status"] == "idle"
            assert by_agent[name]["hmac_verified"] is None
        assert event["agents"]["research"] == "done"
        assert event["agents"]["curator"] == "done"
        assert event["agents"]["defender"] == "idle"


def test_emit_round_events_reports_verified_hmac():
    cid = "test-campaign-live-hmac-ok"
    campaign_live_bus._history[cid].clear()

    signed = _Round()
    signed.hmac_handoffs = [
        {"sender": "campaign_manager", "receiver": "research", "hmac_verified": True, "hmac_state": "ok"},
        {"sender": "research", "receiver": "curator", "hmac_verified": True, "hmac_state": "ok"},
        {"sender": "curator", "receiver": "red_team", "hmac_verified": True, "hmac_state": "ok"},
        {"sender": "red_team", "receiver": "target", "hmac_verified": True, "hmac_state": "ok"},
        {"sender": "target", "receiver": "judge", "hmac_verified": True, "hmac_state": "ok"},
        {"sender": "judge", "receiver": "defender", "hmac_verified": True, "hmac_state": "ok"},
    ]
    signed.defender_result = {"action": "PATCHED"}
    events = emit_round_events(cid, signed)
    assert events[0]["hop"]["hmac_state"] == "ok"
    assert events[1]["hop"]["hmac_verified"] is True
    assert events[2]["hop"]["hmac_state"] == "ok"
    by_agent = {row["agent"]: row for row in events[2]["chain"]}
    assert all(row["status"] == "executed" for row in by_agent.values())
    assert all(row["hmac_state"] == "ok" for row in by_agent.values())


def test_emit_round_events_null_latency_when_unmeasured():
    cid = "test-campaign-live-nolat"
    campaign_live_bus._history[cid].clear()

    class _Untimed(_Round):
        hop_latency_ms = HopLatencyMs()

    events = emit_round_events(cid, _Untimed())
    assert all(e["hop"]["latency_ms"] is None for e in events)


def test_default_agents_can_report_all_campaign_roles_running():
    running = default_agents("running")
    assert set(running.values()) == {"running"}


def test_emit_campaign_status_chain_reports_wired_roles_idle():
    cid = "test-campaign-status-chain"
    campaign_live_bus._history[cid].clear()
    payload = emit_campaign_status(cid, "RUNNING")
    assert payload["hmac_state"] == "unwired"
    assert payload["hmac_verified"] is None
    assert payload["agents"]["research"] == "idle"
    statuses = {row["agent"]: row["status"] for row in payload["chain"]}
    assert set(statuses.values()) == {"idle"}
    assert statuses["red_team"] == "idle"
