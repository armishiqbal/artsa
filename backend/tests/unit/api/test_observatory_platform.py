"""Observatory platform status tests."""

from fastapi.testclient import TestClient
from src.api.main import app
from tests.conftest import unwrap_response

client = TestClient(app)


def test_observatory_includes_platform():
    response = client.get("/api/v1/observatory")
    assert response.status_code == 200
    body = unwrap_response(response)
    assert "platform" in body
    platform = body["platform"]
    assert "rag_backend" in platform
    assert "oidc_enabled" in platform
    assert "embedding_model" in platform


def test_observatory_includes_ablation_schedule():
    response = client.get("/api/v1/observatory")
    assert response.status_code == 200
    schedule = unwrap_response(response).get("ablation_schedule")
    assert schedule is not None
    assert "enabled" in schedule
    assert "interval_sec" in schedule
    assert "runs_total" in schedule
