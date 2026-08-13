"""Attack library semantic search API tests."""

from fastapi.testclient import TestClient

from src.api.main import app
from tests.conftest import unwrap_response

client = TestClient(app)


def test_attack_library_list_endpoint():
    """Regression: GET /attack-library must not 500 (semantic_search_available
    previously called len() on an int count from get_collection_stats)."""
    response = client.get("/api/v1/attack-library")
    assert response.status_code == 200
    body = unwrap_response(response)
    assert "categories" in body
    assert "templates" in body
    assert "semantic_search_available" in body
    assert isinstance(body["semantic_search_available"], bool)


def test_attack_library_search_returns_ranked_results():
    response = client.get("/api/v1/attack-library/search", params={"q": "jailbreak roleplay", "limit": 5})
    assert response.status_code == 200
    body = unwrap_response(response)
    assert body["count"] >= 1
    assert body["query"] == "jailbreak roleplay"
    assert body["results"][0]["score"] > 0
    assert "name" in body["results"][0]


def test_attack_library_search_category_filter():
    response = client.get(
        "/api/v1/attack-library/search",
        params={"q": "prompt injection", "category": "DPI", "limit": 3},
    )
    assert response.status_code == 200
    body = unwrap_response(response)
    assert all(row.get("category") == "DPI" for row in body["results"])
