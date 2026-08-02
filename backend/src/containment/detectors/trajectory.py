"""Stepwise trajectory monitor wired into containment pipeline."""

from __future__ import annotations

from collections import defaultdict, deque
from typing import Deque, Dict, Optional

from src.agents.action_monitor import StepwiseActionMonitor
from src.containment.detectors.base import BaseDetector
from src.core.models.events import SecurityEvent, ToolCallEvent


class TrajectoryDetector(BaseDetector):
    """Wraps StepwiseActionMonitor for live session trajectory evaluation."""

    def __init__(self) -> None:
        super().__init__(name="TrajectoryDetector")
        self._monitor = StepwiseActionMonitor()
        self._trajectories: Dict[str, Deque[dict]] = defaultdict(lambda: deque(maxlen=50))

    def detect(self, event: ToolCallEvent) -> Optional[SecurityEvent]:
        sid = str(event.session_id)
        self._trajectories[sid].append(
            {"tool_name": event.tool_name, "arguments": event.arguments}
        )

        trajectory = list(self._trajectories[sid])
        evaluation = self._monitor.evaluate_trajectory(trajectory)

        if evaluation.trajectory_verdict == "EXPLOIT":
            return SecurityEvent(
                session_id=event.session_id,
                agent_id=event.agent_id,
                event_type="GOAL_DRIFT",
                severity="CRITICAL",
                risk_score=min(100.0, evaluation.overall_anomaly_score * 10),
                description=(
                    f"Trajectory exploit detected: {evaluation.anomalous_steps} anomalous steps "
                    f"(score={evaluation.overall_anomaly_score})"
                ),
                evidence={
                    "trajectory_verdict": evaluation.trajectory_verdict,
                    "anomalous_steps": evaluation.anomalous_steps,
                    "overall_score": evaluation.overall_anomaly_score,
                },
                detector=self.name,
            )

        if evaluation.trajectory_verdict == "SUSPICIOUS":
            return SecurityEvent(
                session_id=event.session_id,
                agent_id=event.agent_id,
                event_type="GOAL_DRIFT",
                severity="MEDIUM",
                risk_score=min(70.0, evaluation.overall_anomaly_score * 8),
                description=f"Suspicious trajectory drift (score={evaluation.overall_anomaly_score})",
                evidence={"trajectory_verdict": evaluation.trajectory_verdict},
                detector=self.name,
            )

        return None
