"""Agent runtime APIs — EDS fast-path + trajectory monitoring."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.agents.action_monitor import StepwiseActionMonitor, TrajectoryEvaluation
from src.agents.eds_engine import (
    EscapeDetectionEngine,
    ToolCallMonitorRequest,
    ToolCallMonitorResponse,
)

router = APIRouter(tags=["Agents"])

_eds = EscapeDetectionEngine()
_monitor = StepwiseActionMonitor()


class TrajectoryRequest(BaseModel):
    trajectory: list[dict[str, Any]] = Field(default_factory=list)
    user_intent: str = ""


@router.post("/agents/eds/monitor", response_model=ToolCallMonitorResponse)
def eds_monitor_tool_call(req: ToolCallMonitorRequest) -> ToolCallMonitorResponse:
    """Sub-50ms escape detection for a single agent tool call (fast path)."""
    return _eds.monitor_tool_call(req)


@router.post("/agents/trajectory/evaluate", response_model=TrajectoryEvaluation)
def evaluate_agent_trajectory(req: TrajectoryRequest) -> TrajectoryEvaluation:
    """Evaluate a multi-step tool trajectory for anomalous / exploit patterns."""
    return _monitor.evaluate_trajectory(req.trajectory, user_intent=req.user_intent)
