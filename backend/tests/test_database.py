"""Unit tests for Supabase / PostgreSQL DatabaseManager and ORM persistence."""

from src.data.database import DatabaseManager


def test_database_manager_sqlite_fallback():
    # Test with SQLite fallback URL
    db = DatabaseManager(db_url="sqlite:///:memory:")
    assert db.engine is not None
    assert db.SessionLocal is not None

    # Test saving campaign summary
    campaign_data = {
        "campaign_id": "test-c1",
        "name": "Unit Test Campaign",
        "state": "COMPLETED",
        "provider": "openai",
        "model": "gpt-5.6-terra",
        "total_rounds": 5,
        "completed_rounds": 5,
        "avg_attack_success": 2.5,
        "avg_defense_quality": 8.5,
        "avg_bypass_depth": 1.2,
    }

    db.save_campaign(campaign_data)
    all_campaigns = db.get_all_campaigns()
    assert len(all_campaigns) == 1
    assert all_campaigns[0]["id"] == "test-c1"
    assert all_campaigns[0]["name"] == "Unit Test Campaign"
