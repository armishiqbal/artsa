"""End-to-End API Gateway integration test suite."""

import os
import sys
import pytest
from pathlib import Path

# Add project directories to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
API_GATEWAY_DIR = PROJECT_ROOT / "api-gateway"
BACKEND_DIR = PROJECT_ROOT / "backend"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(API_GATEWAY_DIR) not in sys.path:
    sys.path.insert(0, str(API_GATEWAY_DIR))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from gateway import app

client = TestClient(app)


def test_api_gateway_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "available_providers" in data


def test_api_gateway_list_providers():
    response = client.get("/api/v1/providers")
    assert response.status_code == 200
    data = response.json()
    assert "providers" in data
    assert len(data["providers"]) >= 5
    provider_ids = [p["id"] for p in data["providers"]]
    assert "groq" in provider_ids
    assert "mistral" in provider_ids
    assert "deepseek" in provider_ids


def test_api_gateway_attack_library():
    response = client.get("/api/v1/attack-library")
    assert response.status_code == 200
    data = response.json()
    assert "categories" in data
    assert "total_templates" in data
    assert data["total_templates"] >= 20


def test_api_gateway_run_and_get_campaign():
    # 1. Spawn campaign
    run_response = client.post(
        "/api/v1/campaigns/run",
        json={
          "name": "E2E Test Campaign",
          "provider": "groq",
          "model": "llama-3.3-70b-versatile",
          "attack_profile": "quick_scan",
          "max_rounds": 2,
        },
    )
    assert run_response.status_code == 200
    run_data = run_response.json()
    assert "campaign_id" in run_data
    campaign_id = run_data["campaign_id"]

    # 2. Get status of spawned campaign
    detail_response = client.get(f"/api/v1/campaigns/{campaign_id}")
    assert detail_response.status_code == 200
    detail_data = detail_response.json()
    assert detail_data["status"] in ["RUNNING", "COMPLETED"]
