"""SQL injection detector tests."""

import uuid

from src.containment.detectors.sql_injection import SqlInjectionDetector
from src.core.models.events import ToolCallEvent


def _event(tool: str, args: dict) -> ToolCallEvent:
    return ToolCallEvent(
        session_id=uuid.uuid4(),
        agent_id="test-agent",
        tool_name=tool,
        arguments=args,
    )


def test_destructive_ddl_dml_flagged():
    detector = SqlInjectionDetector()
    for sql in [
        "SELECT * FROM users; DROP TABLE users;-- variant-4",  # benchmark shape
        "DELETE FROM orders",
        "DROP DATABASE prod",
        "TRUNCATE TABLE logs",
        "UPDATE users SET role='admin' WHERE id=1; ALTER TABLE users DROP COLUMN password",
        "SELECT * FROM users; exec xp_cmdshell('whoami')",
    ]:
        evt = detector.detect(_event("query_db", {"sql": sql}))
        assert evt is not None, f"expected SQL_INJECTION for: {sql}"
        assert evt.event_type == "SQL_INJECTION"
        assert evt.risk_score >= 85.0, f"{sql} scored {evt.risk_score}"


def test_suspicious_probes_flagged_medium():
    detector = SqlInjectionDetector()
    for sql in [
        "SELECT * FROM products WHERE id=1 UNION SELECT password FROM users",
        "SELECT * FROM users WHERE name='admin' OR 1=1 --",
        "SELECT @@version",
    ]:
        evt = detector.detect(_event("query_db", {"sql": sql}))
        assert evt is not None, f"expected detection for: {sql}"
        assert evt.risk_score >= 50.0


def test_safe_sql_not_flagged():
    detector = SqlInjectionDetector()
    for sql in [
        "SELECT id, name FROM products WHERE active = true LIMIT 10",
        "SELECT email FROM users WHERE role = 'admin'",
        "INSERT INTO audit_log (event) VALUES ('login') RETURNING id",  # benign INSERT
    ]:
        assert detector.detect(_event("query_db", {"sql": sql})) is None, f"false positive: {sql}"


def test_non_sql_field_falls_back_to_arguments():
    detector = SqlInjectionDetector()
    evt = detector.detect(_event("query_db", {"query": "SELECT * FROM users; DROP TABLE users;"}))
    assert evt is not None and evt.risk_score >= 85.0


def test_registered_in_engine_reaches_kill():
    from src.containment.engine import ContainmentEngine

    engine = ContainmentEngine()
    risk, verdict, _ = engine.evaluate_event(_event("query_db", {"sql": "SELECT * FROM users; DROP TABLE users;"}))
    assert risk.overall_score >= 80.0
    assert verdict.recommended_action == "KILL"
