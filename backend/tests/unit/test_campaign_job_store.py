"""Campaign job store tests."""

import uuid

from src.data.campaign_job_store import CampaignJobStore


def test_campaign_job_lifecycle(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "testing")
    store = CampaignJobStore()
    cid = str(uuid.uuid4())

    store.create(
        cid,
        name="Test Campaign",
        provider="groq",
        model="llama-3.3-70b-versatile",
        attack_profile="quick_scan",
        max_rounds=5,
        request_json={"name": "Test Campaign"},
    )
    store.update_progress(cid, 2)

    job = store.get(cid)
    assert job is not None
    assert job["status"] == "RUNNING"
    assert job["rounds_completed"] == 2

    store.complete(cid, {"completed_rounds": 5, "total_rounds": 5})
    job = store.get(cid)
    assert job["status"] == "COMPLETED"
    assert job["rounds_completed"] == 5
