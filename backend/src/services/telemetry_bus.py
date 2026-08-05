"""Live telemetry broadcast bus for WebSocket subscribers."""

from __future__ import annotations

import asyncio
from collections import deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List, Set


class TelemetryBus:
    """In-process pub/sub for containment events and dashboard metrics."""

    def __init__(self, history_size: int = 500) -> None:
        self._subscribers: Set[asyncio.Queue] = set()
        self._history: Deque[Dict[str, Any]] = deque(maxlen=history_size)
        self._severity_counts: Dict[str, int] = {
            "CRITICAL": 0,
            "HIGH": 0,
            "MEDIUM": 0,
            "LOW": 0,
        }

    def publish(self, event: Dict[str, Any]) -> None:
        event.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
        self._history.append(event)

        severity = event.get("severity")
        if severity in self._severity_counts:
            self._severity_counts[severity] += 1

        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass

    async def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)

    def get_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        return list(self._history)[-limit:]

    def get_severity_counts(self) -> Dict[str, int]:
        return dict(self._severity_counts)

    def get_risk_trend(self, limit: int = 24) -> List[Dict[str, Any]]:
        points = []
        for evt in list(self._history)[-limit:]:
            if "risk_score" in evt:
                points.append(
                    {
                        "timestamp": evt.get("timestamp"),
                        "risk_score": evt.get("risk_score"),
                        "tool_name": evt.get("tool_name"),
                    }
                )
        return points

    def clear(self) -> None:
        """Reset history and severity counters (testing)."""
        self._history.clear()
        for key in self._severity_counts:
            self._severity_counts[key] = 0


telemetry_bus = TelemetryBus()
