"""Campaign live bus — emit + history for Live Monitor."""

from src.services.campaign_live_bus import (
    campaign_live_bus,
    emit_round_events,
    verdict_to_outcome,
)


class _Cat:
    value = "DPI"


class _Attack:
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
