"""Statistical anomaly detector with per-session baselines.

WORKPACKAGE B (B1): argument-string Shannon entropy is *not* a security
signal — ordinary commands such as ``ls -la /tmp`` score high-entropy and
were being KILLed as PRIVILEGE_ESCALATION. Entropy-based privilege scoring is
removed. A privileged tool is now flagged only on real signals:
  1. a rate spike vs. this session's baseline, or
  2. a destructive command construct in the arguments (the content signal), or
  3. an unusual tool sequence (privileged tool immediately after data access).

Calls that match a known benign command (ls/cat/grep/... ) with no destructive
construct are left alone, and non-benign calls with no destructive construct
do not trip an escalation on their own — the trajectory/sequence detectors
still catch abusive patterns.
"""

from __future__ import annotations

import re
from collections import defaultdict, deque
from datetime import UTC, datetime

from src.containment.detectors.base import BaseDetector
from src.core.models.events import SecurityEvent, ToolCallEvent

PRIVILEGED_TOOLS = frozenset(
    {
        "exec_command",
        "execute_command",
        "execute_system_command",
        "eval",
        "system",
        "shell",
        "run_code",
    }
)

# Destructive command constructs: a *content* signal matched before the benign
# allow-list so genuinely destructive arguments are never suppressed. Kept
# here (alongside RuleBasedDetector) so destructive probes stay >= 90 now that
# the entropy heuristic no longer inflates privileged-tool scores.
# (regex, risk_score, event_type, description)
DESTRUCTIVE_ARG_PATTERNS: list[tuple[re.Pattern[str], float, str, str]] = [
    (
        re.compile(r"(?i)rm\s+-rf\s*/|rm\s+-rf\s*$"),
        95.0,
        "SANDBOX_ESCAPE",
        "Recursive destructive delete",
    ),
    (
        re.compile(r"(?i)/etc/(?:shadow|passwd)"),
        90.0,
        "CREDENTIAL_THEFT",
        "Sensitive credential file access",
    ),
    (
        re.compile(r"(?i)169\.254\.169\.254"),
        92.0,
        "EGRESS_TUNNEL",
        "Cloud metadata endpoint probe",
    ),
    (
        re.compile(r"(?i)nc\s+-e|ncat\s+-e|bash\s+-i|/dev/tcp/"),
        95.0,
        "REVERSE_SHELL",
        "Reverse shell egress",
    ),
    (
        re.compile(r"(?i)base64\s+-d\b|base64\s+--decode\b"),
        88.0,
        "CODE_EXECUTION_ABUSE",
        "Base64-decoded payload execution",
    ),
    (
        re.compile(r"(?i)\|\s*(?:ba|s)?sh\b|>\s*/dev/(?!null\b)|mkfs|dd\s+if=|chmod\s+777"),
        85.0,
        "PRIVILEGE_ESCALATION",
        "Destructive shell construct",
    ),
]

# Commands an agent routinely runs through a privileged tool. A call matching
# one of these with no destructive construct is suppressed (SAFE).
BENIGN_COMMANDS = frozenset(
    {
        "ls",
        "cat",
        "head",
        "tail",
        "grep",
        "pwd",
        "echo",
        "printf",
        "mkdir",
        "cp",
        "mv",
        "touch",
        "find",
        "wc",
        "df",
        "du",
        "ps",
        "top",
        "whoami",
        "date",
        "env",
        "file",
        "uname",
        "uptime",
        "free",
        "stat",
        "diff",
        "sort",
        "cut",
        "sed",
        "awk",
        "tar",
        "zip",
        "unzip",
        "make",
        "chmod",
        "chown",
        "ln",
        "readlink",
        "hostname",
        "hostname -I",
        "curl --version",
    }
)


class StatisticalDetector(BaseDetector):
    """Detects rate spikes, unusual tool sequences, and destructive privileged-tool calls."""

    RATE_WINDOW_SEC = 60.0
    RATE_SPIKE_THRESHOLD = 8
    SEQUENCE_ANOMALY_TOOLS = frozenset({"exec_command", "eval", "export_pii", "delete_user"})

    def __init__(self) -> None:
        super().__init__(name="StatisticalDetector")
        self._timestamps: dict[str, deque[float]] = defaultdict(lambda: deque(maxlen=50))
        self._tool_sequences: dict[str, deque[str]] = defaultdict(lambda: deque(maxlen=20))
        self._baseline_rates: dict[str, float] = {}

    def detect(self, event: ToolCallEvent) -> SecurityEvent | None:
        sid = str(event.session_id)
        now = datetime.now(UTC).timestamp()
        self._timestamps[sid].append(now)
        self._tool_sequences[sid].append(event.tool_name)

        # Rate spike vs session baseline
        recent = [t for t in self._timestamps[sid] if now - t <= self.RATE_WINDOW_SEC]
        current_rate = len(recent)
        baseline = self._baseline_rates.get(sid, 3.0)
        if current_rate > max(self.RATE_SPIKE_THRESHOLD, baseline * 2.5):
            return self._event(
                event,
                "PRIVILEGE_ESCALATION",
                "HIGH",
                78.0,
                f"Tool call rate spike: {current_rate}/min (baseline {baseline:.1f})",
                {"rate_per_min": current_rate, "baseline": baseline},
            )

        # Update rolling baseline (exponential moving average)
        self._baseline_rates[sid] = baseline * 0.8 + current_rate * 0.2

        # Privileged tool: destructive construct -> high; benign command -> SAFE.
        if event.tool_name in PRIVILEGED_TOOLS:
            args_text = self._command_text(event)
            for pattern, score, event_type, label in DESTRUCTIVE_ARG_PATTERNS:
                if pattern.search(args_text):
                    severity = "CRITICAL" if score >= 90.0 else "HIGH"
                    return self._event(
                        event,
                        event_type,
                        severity,
                        score,
                        f"{label} via {event.tool_name}",
                        {"tool_name": event.tool_name, "matched": label},
                    )
            if self._first_command_token(args_text) in BENIGN_COMMANDS:
                return None
            # Unknown/non-benign command with no destructive construct carries
            # no standalone statistical signal — the sequence/rate detectors
            # still catch abusive patterns.
            return None

        # Unusual tool sequence: privileged tool after data access
        seq = list(self._tool_sequences[sid])
        if (
            len(seq) >= 2
            and seq[-2] in {"read_file", "search_documents", "query_db"}
            and seq[-1] in self.SEQUENCE_ANOMALY_TOOLS
        ):
            return self._event(
                event,
                "PRIVILEGE_ESCALATION",
                "HIGH",
                80.0,
                f"Suspicious tool sequence: {seq[-2]} -> {seq[-1]}",
                {"sequence": seq[-3:]},
            )

        return None

    @staticmethod
    def _command_text(event: ToolCallEvent) -> str:
        """Return the command/script text of a tool call, preferring structured fields."""
        args = event.arguments
        if isinstance(args, dict):
            for key in ("command", "cmd", "input", "code", "script", "payload", "shell_command"):
                val = args.get(key)
                if isinstance(val, str):
                    return val
            return str(args)
        return str(args)

    @staticmethod
    def _first_command_token(text: str) -> str:
        """First whitespace-separated token, path/quotes stripped (ls /usr/bin/ls)."""
        if not text:
            return ""
        tokens = text.strip().split()
        if not tokens:
            return ""
        return tokens[0].strip("\"'").rsplit("/", 1)[-1]

    def _event(
        self,
        event: ToolCallEvent,
        event_type: str,
        severity: str,
        risk_score: float,
        description: str,
        evidence: dict,
    ) -> SecurityEvent:
        return SecurityEvent(
            session_id=event.session_id,
            agent_id=event.agent_id,
            event_type=event_type,
            severity=severity,
            risk_score=risk_score,
            description=description,
            evidence=evidence,
            detector=self.name,
        )
