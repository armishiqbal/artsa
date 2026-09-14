"""In-process Prometheus-style metrics (text exposition format)."""

from __future__ import annotations

import threading
import time

_lock = threading.Lock()
_ingest_total = 0
_ingest_latency_ms_sum = 0.0
_ws_connections = 0
_benchmark_runs = 0
_playground_runs = {
    "passed": 0,
    "blocked": 0,
    "quarantined": 0,
    "unavailable": 0,
    "malformed_stream": 0,
    "cancelled": 0,
}
_playground_evaluation_latency_ms_sum = 0.0
_playground_evaluation_latency_count = 0
_github_executions = {"executed": 0, "failed": 0, "output_blocked": 0, "retry_rejected": 0}
_github_execution_latency_ms_sum = 0.0
_github_execution_latency_count = 0
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


def record_playground_run(outcome: str, latency_ms: float | None = None) -> None:
    global _playground_evaluation_latency_ms_sum, _playground_evaluation_latency_count
    normalized = {
        "flagged": "blocked",
        "approval": "quarantined",
    }.get(outcome, outcome)
    with _lock:
        if normalized in _playground_runs:
            _playground_runs[normalized] += 1
        if latency_ms is not None:
            _playground_evaluation_latency_ms_sum += max(0.0, float(latency_ms))
            _playground_evaluation_latency_count += 1


def record_github_execution(outcome: str, latency_ms: float | None = None) -> None:
    global _github_execution_latency_ms_sum, _github_execution_latency_count
    with _lock:
        if outcome in _github_executions:
            _github_executions[outcome] += 1
        if latency_ms is not None:
            _github_execution_latency_ms_sum += max(0.0, float(latency_ms))
            _github_execution_latency_count += 1


def render_prometheus(active_sessions: int = 0, severity: dict[str, int] | None = None) -> str:
    """Render metrics in Prometheus text exposition format."""
    with _lock:
        ingest_total = _ingest_total
        latency_sum = _ingest_latency_ms_sum
        ws_open = _ws_connections
        benchmark_runs = _benchmark_runs
        playground_runs = dict(_playground_runs)
        playground_latency_sum = _playground_evaluation_latency_ms_sum
        playground_latency_count = _playground_evaluation_latency_count
        github_executions = dict(_github_executions)
        github_latency_sum = _github_execution_latency_ms_sum
        github_latency_count = _github_execution_latency_count

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
        "# HELP artsa_playground_runs_total Playground terminal runs by outcome",
        "# TYPE artsa_playground_runs_total counter",
        *[f'artsa_playground_runs_total{{outcome="{outcome}"}} {count}' for outcome, count in playground_runs.items()],
        "# HELP artsa_playground_evaluation_latency_ms Evaluation latency in milliseconds",
        "# TYPE artsa_playground_evaluation_latency_ms summary",
        f"artsa_playground_evaluation_latency_ms_sum {playground_latency_sum:.3f}",
        f"artsa_playground_evaluation_latency_ms_count {playground_latency_count}",
        "# HELP artsa_github_execution_total Managed GitHub execution terminal outcomes",
        "# TYPE artsa_github_execution_total counter",
        *[f'artsa_github_execution_total{{outcome="{outcome}"}} {count}' for outcome, count in github_executions.items()],
        "# HELP artsa_github_execution_latency_ms Managed GitHub execution latency in milliseconds",
        "# TYPE artsa_github_execution_latency_ms summary",
        f"artsa_github_execution_latency_ms_sum {github_latency_sum:.3f}",
        f"artsa_github_execution_latency_ms_count {github_latency_count}",
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
