"""Statistical anomaly detector with per-session baselines."""

from __future__ import annotations

import math
import uuid
from collections import Counter, defaultdict, deque
from datetime import datetime, timezone
from typing import Deque, Dict, Optional

from src.containment.detectors.base import BaseDetector
from src.core.models.events import SecurityEvent, ToolCallEvent

PRIVILEGED_TOOLS = frozenset({"exec_command", "eval", "system", "shell", "run_code"})


class StatisticalDetector(BaseDetector):
    """Detects rate spikes, unusual tool sequences, and argument entropy anomalies."""

    RATE_WINDOW_SEC = 60.0
    RATE_SPIKE_THRESHOLD = 8
    ENTROPY_THRESHOLD = 4.5
    SEQUENCE_ANOMALY_TOOLS = frozenset({"exec_command", "eval", "export_pii", "delete_user"})

    def __init__(self) -> None:
        super().__init__(name="StatisticalDetector")
        self._timestamps: Dict[str, Deque[float]] = defaultdict(lambda: deque(maxlen=50))
        self._tool_sequences: Dict[str, Deque[str]] = defaultdict(lambda: deque(maxlen=20))
        self._baseline_rates: Dict[str, float] = {}

    def detect(self, event: ToolCallEvent) -> Optional[SecurityEvent]:
        sid = str(event.session_id)
        now = datetime.now(timezone.utc).timestamp()
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

        # Privileged tool with high argument entropy
        if event.tool_name in PRIVILEGED_TOOLS:
            entropy = self._shannon_entropy(str(event.arguments))
            if entropy >= self.ENTROPY_THRESHOLD:
                return self._event(
                    event,
                    "PRIVILEGE_ESCALATION",
                    "HIGH",
                    75.0 + min(15.0, entropy),
                    f"High-entropy privileged tool call (entropy={entropy:.2f})",
                    {"tool_name": event.tool_name, "entropy": round(entropy, 3)},
                )
            return self._event(
                event,
                "PRIVILEGE_ESCALATION",
                "MEDIUM",
                65.0,
                f"Privileged tool execution: {event.tool_name}",
                {"tool_name": event.tool_name},
            )

        # Unusual tool sequence: privileged tool after data access
        seq = list(self._tool_sequences[sid])
        if len(seq) >= 2 and seq[-2] in {"read_file", "search_documents", "query_db"}:
            if seq[-1] in self.SEQUENCE_ANOMALY_TOOLS:
                return self._event(
                    event,
                    "PRIVILEGE_ESCALATION",
                    "HIGH",
                    80.0,
                    f"Suspicious tool sequence: {seq[-2]} -> {seq[-1]}",
                    {"sequence": seq[-3:]},
                )

        return None

    def _shannon_entropy(self, text: str) -> float:
        if not text:
            return 0.0
        counts = Counter(text)
        length = len(text)
        return -sum((c / length) * math.log2(c / length) for c in counts.values())

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
