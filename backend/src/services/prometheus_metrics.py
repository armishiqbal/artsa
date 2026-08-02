"""In-process Prometheus-style metrics (text exposition format)."""

from __future__ import annotations

import threading
import time
from typing import Dict

_lock = threading.Lock()
_ingest_total = 0
_ingest_latency_ms_sum = 0.0
_ws_connections = 0
_benchmark_runs = 0
_start_time = time.time()


def record_ingest(latency_ms: float) -> None:
    global _ingest_total, _ingest_latency_ms_sum
    with _lock:
        _ingest_total += 1
        _ingest_latency_ms_sum += latency_ms


def record_ws_connect() -> None:
    global _ws_connections
    with _lock:
        _ws_connections += 1


def record_ws_disconnect() -> None:
    global _ws_connections
    with _lock:
        _ws_connections = max(0, _ws_connections - 1)


def record_benchmark_run() -> None:
    global _benchmark_runs
    with _lock:
        _benchmark_runs += 1


def render_prometheus(active_sessions: int = 0, severity: Dict[str, int] | None = None) -> str:
    """Render metrics in Prometheus text exposition format."""
    with _lock:
        ingest_total = _ingest_total
        latency_sum = _ingest_latency_ms_sum
        ws_open = _ws_connections
        benchmark_runs = _benchmark_runs

    uptime = time.time() - _start_time
    sev = severity or {}
    lines = [
        "# HELP artsa_up ARTSA API process is running",
        "# TYPE artsa_up gauge",
        "artsa_up 1",
        "# HELP artsa_uptime_seconds Process uptime",
        "# TYPE artsa_uptime_seconds gauge",
        f"artsa_uptime_seconds {uptime:.3f}",
        "# HELP artsa_ingest_total Total tool-call ingest requests",
        "# TYPE artsa_ingest_total counter",
        f"artsa_ingest_total {ingest_total}",
        "# HELP artsa_ingest_latency_ms_sum Cumulative ingest latency milliseconds",
        "# TYPE artsa_ingest_latency_ms_sum counter",
        f"artsa_ingest_latency_ms_sum {latency_sum:.3f}",
        "# HELP artsa_websocket_connections Active WebSocket connections",
        "# TYPE artsa_websocket_connections gauge",
        f"artsa_websocket_connections {ws_open}",
        "# HELP artsa_active_sessions Active containment sessions",
        "# TYPE artsa_active_sessions gauge",
        f"artsa_active_sessions {active_sessions}",
        "# HELP artsa_benchmark_runs_total Benchmark harness executions",
        "# TYPE artsa_benchmark_runs_total counter",
        f"artsa_benchmark_runs_total {benchmark_runs}",
    ]

    for level in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        lines.extend(
            [
                f"# HELP artsa_events_severity_{level.lower()} Events by severity",
                f"# TYPE artsa_events_severity_{level.lower()} gauge",
                f"artsa_events_severity_{level.lower()} {sev.get(level, 0)}",
            ]
        )

    return "\n".join(lines) + "\n"
