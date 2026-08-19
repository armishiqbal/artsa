"""Prometheus metrics endpoint tests."""

from fastapi.testclient import TestClient
from src.api.main import app
from src.services.prometheus_metrics import record_ingest, render_prometheus

client = TestClient(app)


def test_prometheus_endpoint_public():
    response = client.get("/api/v1/metrics/prometheus")
    assert response.status_code == 200
    assert "text/plain" in response.headers.get("content-type", "")
    assert "artsa_up 1" in response.text
    assert "artsa_ingest_total" in response.text


def test_record_ingest_increments_counter():
    before = render_prometheus()
    record_ingest(12.5)
    after = render_prometheus()
    assert after != before
    assert "artsa_ingest_latency_ms_sum" in after
