"""SQL injection detector for database tool calls.

Detects destructive DDL/DML, stacked queries, comment obfuscation, and SQL
function abuse in the ``sql`` / ``query`` / ``statement`` arguments of tools
such as ``query_db``. Regex-only, sub-ms, fully offline — no LLM.

Scores are tuned so destructive patterns land in the BREACHED (>=80) band and
softer probes land in SUSPICIOUS (>=50), matching the existing detector style.
"""

from __future__ import annotations

import re
from typing import ClassVar

from src.containment.detectors.base import BaseDetector
from src.core.models.events import SecurityEvent, ToolCallEvent


def _normalize_sql(text: str) -> str:
    """De-obfuscate SQL before matching.

    * Strip block comments (``/* ... */`` and ``/**/``) that attackers use to
      break up keyword matches (``OR/**/1=1``, ``DROP/**/TABLE``, ``U/**/NION``).
    * Drop an optional trailing ``;`` so stacked-statement and keyword rules
      both see the cleaned statement.
    """
    cleaned = re.sub(r"/\*.*?\*/", " ", text, flags=re.DOTALL)
    return cleaned


# (regex, risk_score, description) — ordered most specific / highest-signal first
SQL_PATTERNS: ClassVar[list[tuple[str, float, str]]] = [
    (
        r";\s*(drop|truncate|delete\s+from|insert\s+into|update\s+\w+\s+set|alter\s+table|exec)\b",
        90.0,
        "Stacked destructive SQL statement (multiple queries injected)",
    ),
    (
        r"\b(DROP|TRUNCATE|ALTER)\s+(TABLE|DATABASE|SCHEMA|INDEX|SEQUENCE|VIEW)\b",
        88.0,
        "Destructive DDL/DML keyword",
    ),
    (
        r"\bDELETE\s+FROM\b",
        88.0,
        "Destructive DELETE statement",
    ),
    (
        r"(?i)\b(xp_cmdshell|pg_sleep|waitfor\s+delay|into\s+outfile|load_file)\b",
        85.0,
        "Dangerous SQL function / command abuse",
    ),
    (
        r"(?i)\bUNION\s*(?:/\*.*?\*/\s*)?(?:ALL\s+)?SELECT\b",
        82.0,
        "UNION-based SQL injection (incl. comment-obfuscated)",
    ),
    (
        (
            r"(?i)(?:"
            r"\b(password|credit_card|ssn|secret|api_key|token|bank|salary)\b[\s\S]{0,120}\bUNION\s+(ALL\s+)?SELECT\b"
            r"|\bUNION\s+(ALL\s+)?SELECT\b[\s\S]{0,120}\b(password|credit_card|ssn|secret|api_key|token|bank|salary)\b"
            r")"
        ),
        88.0,
        "UNION-based SQL injection targeting sensitive columns (data theft)",
    ),
    (
        r"\bOR\s+'?1'?\s*=\s*'?1'?\b",
        82.0,
        "Boolean-based SQL injection (always-true predicate)",
    ),
    (
        r"(?i)\bUPDATE\s+\w+\s+SET\s+(?:role|is_admin|privilege|access_level|permission|account_status)\s*=\s*['\"]?(?:admin|root|superuser|super_admin|active)",
        88.0,
        "Privilege escalation via SQL UPDATE",
    ),
    (
        r"(?i)@@\s*version\b|information_schema\s*\.",
        45.0,
        "Database fingerprinting (version / schema enumeration) — surfaced for review",
    ),
    (
        r"--\s|#\s+|\s+/\*",
        60.0,
        "SQL comment / inline-comment obfuscation",
    ),
]


class SqlInjectionDetector(BaseDetector):
    """Detects SQL injection in database tool arguments."""

    def __init__(self) -> None:
        super().__init__(name="SqlInjectionDetector")
        self.PATTERNS = SQL_PATTERNS

    def detect(self, event: ToolCallEvent) -> SecurityEvent | None:
        # Prefer structured SQL fields; fall back to scanning all arguments.
        candidates = [
            event.arguments.get(key)
            for key in ("sql", "query", "statement")
            if event.arguments.get(key)
        ]
        raw_text = str(candidates[0]) if candidates else str(event.arguments)
        # Strip SQL comment obfuscation FIRST so keyword patterns match through
        # ``/**/`` separators (e.g. ``DROP/**/TABLE``, ``OR/**/1=1``).
        scan_text = _normalize_sql(raw_text)

        for pattern, risk_score, desc in self.PATTERNS:
            match = re.search(pattern, scan_text)
            if match:
                return SecurityEvent(
                    session_id=event.session_id,
                    agent_id=event.agent_id,
                    event_type="SQL_INJECTION",
                    severity="CRITICAL" if risk_score >= 80 else "HIGH",
                    risk_score=risk_score,
                    description=desc,
                    evidence={
                        "matched_pattern": desc,
                        "matched_text": match.group(0),
                        "tool": event.tool_name,
                        "span": [match.start(), match.end()],
                        "field": "sql" if candidates else "arguments",
                    },
                    detector=self.name,
                )
        return None
