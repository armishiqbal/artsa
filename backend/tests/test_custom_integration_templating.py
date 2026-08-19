"""Unit tests for the custom-integration JSON template renderer.

Covers whole-token typed resolution, dotted-path context lookup, embedded
tokens, secret placeholders, invalid-JSON rejection, and default payload
shapes for the four event types.
"""

from __future__ import annotations

import pytest
from src.services.custom_integration_dispatcher import (
    build_default_payload,
    lookup_path,
    render_json_template,
    render_string,
)

# ─────────────────────────────────────────────────────────────────────────────
# Dotted-path lookup
# ─────────────────────────────────────────────────────────────────────────────


def test_lookup_path_scalar_and_nested():
    context = {"agent_id": "a-1", "meta": {"risk": 85.0}}
    assert lookup_path(context, "agent_id") == "a-1"
    assert lookup_path(context, "meta.risk") == 85.0


def test_lookup_path_list_index():
    context = {"events": [{"detector": "goal_drift"}, {"detector": "tool_abuse"}]}
    assert lookup_path(context, "events.0.detector") == "goal_drift"
    assert lookup_path(context, "events.1.detector") == "tool_abuse"


def test_lookup_path_missing_segments_return_none():
    context = {"agent_id": "a-1"}
    assert lookup_path(context, "missing") is None
    assert lookup_path(context, "meta.risk") is None
    assert lookup_path(context, "events.0.detector") is None
    assert lookup_path(context, "") is None


# ─────────────────────────────────────────────────────────────────────────────
# render_string
# ─────────────────────────────────────────────────────────────────────────────


def test_render_string_whole_token_typed():
    context = {"count": 3, "ok": True, "risk": 85.0}
    assert render_string("{{count}}", context, {}) == 3
    assert render_string("{{ok}}", context, {}) is True
    assert render_string("{{risk}}", context, {}) == 85.0


def test_render_string_whole_token_preserves_nested_structure():
    """Whole-token resolution keeps typed values — a list stays a list."""
    context = {"flags": ["goal_drift", "tool_abuse"]}
    assert render_string("{{flags}}", context, {}) == ["goal_drift", "tool_abuse"]


def test_render_string_embedded_token():
    context = {"agent_id": "a-1", "severity": "HIGH"}
    assert render_string("agent {{agent_id}} · {{severity}}", context, {}) == "agent a-1 · HIGH"


def test_render_string_secret_placeholder():
    assert render_string("{{secret:token}}", {}, {"token": "abc123"}) == "abc123"
    assert render_string("Authorization: Bearer {{secret:token}}", {}, {"token": "xyz"}) == (
        "Authorization: Bearer xyz"
    )


def test_render_string_missing_secret_whole_token_left_untouched():
    assert render_string("{{secret:token}}", {}, {}) == "{{secret:token}}"


def test_render_string_unresolved_embedded_token_left_untouched():
    assert render_string("prefix {{nope.field}} suffix", {}, {}) == "prefix {{nope.field}} suffix"


# ─────────────────────────────────────────────────────────────────────────────
# render_json_template
# ─────────────────────────────────────────────────────────────────────────────


def test_render_json_template_typed_and_dotted():
    template = """
    {
      "agent": "{{agent_id}}",
      "risk": "{{meta.risk}}",
      "events": "{{meta.events.0.detector}}"
    }
    """
    context = {
        "agent_id": "a-1",
        "meta": {"risk": 88.5, "events": [{"detector": "goal_drift"}]},
    }
    rendered = render_json_template(template, context)
    assert rendered["agent"] == "a-1"
    assert rendered["risk"] == 88.5  # typed, not stringified
    assert rendered["events"] == "goal_drift"


def test_render_json_template_secrets():
    template = '{"token": "{{secret:token}}", "label": "svc-{{secret:token}}"}'
    rendered = render_json_template(template, {}, {"token": "s3cret"})
    assert rendered == {"token": "s3cret", "label": "svc-s3cret"}


def test_render_json_template_unresolved_field_preserved():
    template = '{"optional": "{{maybe.there}}"}'
    assert render_json_template(template, {}) == {"optional": "{{maybe.there}}"}
    assert render_json_template(template, {"maybe": {"there": "yes"}}) == {"optional": "yes"}


def test_render_json_template_recurses_lists_and_nested_dicts():
    template = '{"items": [{"n": "{{count}}"}, {"fixed": 7}]}'
    rendered = render_json_template(template, {"count": 42})
    assert rendered == {"items": [{"n": 42}, {"fixed": 7}]}


def test_render_json_template_invalid_json_raises():
    with pytest.raises(ValueError, match="not valid JSON"):
        render_json_template("{ this is not json", {})


# ─────────────────────────────────────────────────────────────────────────────
# build_default_payload
# ─────────────────────────────────────────────────────────────────────────────


def test_build_default_payload_is_event_copy():
    event = {"type": "alert", "risk_score": 85.0, "agent_id": "a-1"}
    payload = build_default_payload("alert", event)
    assert payload == event
    assert payload is not event  # fresh dict, safe to mutate


def test_build_default_payload_tool_call_shape():
    event = {
        "type": "tool_call",
        "session_id": "s-1",
        "agent_id": "a-1",
        "tool_name": "exec_command",
        "risk_score": 91.0,
        "verdict": "BREACHED",
        "flags": ["goal_drift"],
        "security_events": [{"detector": "goal_drift", "risk_score": 88.0}],
    }
    payload = build_default_payload("tool_call", event)
    assert payload["tool_name"] == "exec_command"
    assert payload["security_events"][0]["detector"] == "goal_drift"
