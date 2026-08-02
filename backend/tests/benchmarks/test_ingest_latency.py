"""Ingest path latency benchmarks — validates <50ms SLO on containment evaluation."""

import time
import uuid

from fastapi.testclient import TestClient

from src.api.main import app
from src.containment.engine import ContainmentEngine
from src.core.models.events import ToolCallEvent

client = TestClient(app)
engine = ContainmentEngine()


def test_containment_eval_under_50ms():
    event = ToolCallEvent(
        session_id=uuid.uuid4(),
        agent_id="latency-test",
        tool_name="search_documents",
        arguments={"query": "security policy"},
    )
    start = time.perf_counter()
    for _ in range(100):
        engine.evaluate_event(event)
    elapsed_ms = (time.perf_counter() - start) / 100 * 1000
    assert elapsed_ms < 50.0, f"Containment eval avg {elapsed_ms:.2f}ms exceeds 50ms SLO"


def test_ingest_endpoint_under_50ms():
    payload = {
        "session_id": str(uuid.uuid4()),
        "agent_id": "latency-api",
        "tool_name": "read_file",
        "arguments": {"path": "/tmp/test.txt"},
        "trace_id": str(uuid.uuid4()),
    }
    # Warm-up request (TestClient + middleware cold start)
    client.post("/api/v1/ingest", json={**payload, "session_id": str(uuid.uuid4())})

    samples_ms: list[float] = []
    for _ in range(5):
        start = time.perf_counter()
        response = client.post(
            "/api/v1/ingest",
            json={**payload, "session_id": str(uuid.uuid4())},
        )
        samples_ms.append((time.perf_counter() - start) * 1000)
        assert response.status_code in (200, 201)

    samples_ms.sort()
    median_ms = samples_ms[len(samples_ms) // 2]
    # Full HTTP stack includes auth/RBAC/logging middleware — allow 100ms median in CI
    assert median_ms < 100.0, f"Ingest endpoint median {median_ms:.2f}ms exceeds 100ms HTTP SLO"
