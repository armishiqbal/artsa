"""Unit tests for findings and playbook version stores."""

from src.data.findings_registry import all_records, get_record, set_promoted
from src.data.policy_version_store import current_version, diff_versions, snapshot_rules


def test_policy_version_snapshot_and_diff():
    rules_v1 = [{"name": "a", "pattern": "foo", "event_type": "X", "severity": "HIGH", "risk_score": 80, "description": ""}]
    snapshot_rules(rules_v1, trigger="test", note="v1")
    v1 = current_version()
    rules_v2 = rules_v1 + [{"name": "b", "pattern": "bar", "event_type": "X", "severity": "HIGH", "risk_score": 80, "description": ""}]
    snapshot_rules(rules_v2, trigger="test", note="v2")
    v2 = current_version()
    diff = diff_versions(v1, v2)
    assert len(diff["added"]) >= 1


def test_findings_registry_promoted():
    set_promoted("test-finding-1", rule_name="Block test", playbook_version=1)
    record = get_record("test-finding-1")
    assert record is not None
    assert record["status"] == "promoted"
    assert "test-finding-1" in all_records()
