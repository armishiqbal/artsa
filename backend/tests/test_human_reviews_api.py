"""Tenant-isolated human-review labels and live-quality metric tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from tests.conftest import unwrap_response


@pytest.fixture
def reviews_api(monkeypatch, tmp_path):
    database = tmp_path / "reviews.db"
    monkeypatch.setattr("src.core.config.settings.DATABASE_URL", f"sqlite+aiosqlite:///{database}")
    monkeypatch.setattr("src.core.config.settings.SYNC_DATABASE_URL", f"sqlite:///{database}")
    monkeypatch.setattr("src.data.db._engine", None)
    monkeypatch.setattr("src.data.db._session_factory", None)
    from src.data.orm import Base

    engine = create_engine(f"sqlite:///{database}")
    Base.metadata.create_all(engine)
    engine.dispose()
    from src.api.main import create_app

    return TestClient(create_app())


def _review(client: TestClient, source_ref: str, classification: str, tenant: str = "tenant-a"):
    return client.post(
        "/api/v1/reviews",
        headers={"X-Tenant-ID": tenant},
        json={
            "source_type": "event",
            "source_ref": source_ref,
            "classification": classification,
            "machine_verdict": "BLOCKED",
            "reason_code": "operator_validation",
        },
    )


def test_human_review_metrics_are_tenant_scoped_and_correctable(reviews_api):
    for source_ref, classification in (
        ("event-tp", "true_positive"),
        ("event-fp", "false_positive"),
        ("event-fn", "false_negative"),
        ("event-tn", "true_negative"),
    ):
        assert _review(reviews_api, source_ref, classification).status_code == 201
    assert _review(reviews_api, "other-tenant", "false_negative", "tenant-b").status_code == 201

    metrics = unwrap_response(
        reviews_api.get("/api/v1/reviews/metrics", headers={"X-Tenant-ID": "tenant-a"})
    )
    assert metrics["basis"] == "human_review"
    assert metrics["reviewed_cases"] == 4
    assert metrics["precision"] == 50.0
    assert metrics["recall"] == 50.0
    assert metrics["false_positive_rate"] == 50.0
    assert metrics["false_negative_rate"] == 50.0

    # Correcting a source reference replaces its current label instead of
    # inflating metrics with duplicate operator submissions.
    assert _review(reviews_api, "event-fn", "true_positive").status_code == 201
    corrected = unwrap_response(
        reviews_api.get("/api/v1/reviews/metrics", headers={"X-Tenant-ID": "tenant-a"})
    )
    assert corrected["reviewed_cases"] == 4
    assert corrected["true_positive"] == 2
    assert corrected["false_negative"] == 0
    assert corrected["recall"] == 100.0


def test_human_review_rejects_unknown_or_unbounded_fields(reviews_api):
    response = reviews_api.post(
        "/api/v1/reviews",
        json={
            "source_type": "event",
            "source_ref": "event-1",
            "classification": "false_positive",
            "raw_prompt": "must not be accepted",
        },
    )
    assert response.status_code == 422
