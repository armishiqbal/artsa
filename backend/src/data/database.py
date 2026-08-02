"""Minimal SQLite-backed database manager used by tests and local runs."""

from __future__ import annotations

import sqlite3
from typing import Any


class DatabaseManager:
    """Simple persistence wrapper with an interface compatible with tests."""

    def __init__(self, db_url: str | None = None) -> None:
        self.db_url = db_url or "sqlite:///artsa.db"
        self._sqlite_path = self._parse_sqlite_path(self.db_url)
        self._conn: sqlite3.Connection | None = None
        self.engine = self.db_url
        self.SessionLocal = self._connect
        self._init_db()

    def _parse_sqlite_path(self, db_url: str) -> str:
        if db_url.startswith("sqlite:///"):
            return db_url.removeprefix("sqlite:///")
        return ":memory:"

    def _connect(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(self._sqlite_path)
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def _init_db(self) -> None:
        conn = self._connect()
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS campaigns (
                id TEXT PRIMARY KEY,
                name TEXT,
                state TEXT,
                provider TEXT,
                model TEXT,
                total_rounds INTEGER,
                completed_rounds INTEGER,
                avg_attack_success REAL,
                avg_defense_quality REAL,
                avg_bypass_depth REAL
            )
            """
        )
        conn.commit()

    def save_campaign(self, campaign_data: dict[str, Any]) -> None:
        conn = self._connect()
        conn.execute(
            """
            INSERT OR REPLACE INTO campaigns (
                id, name, state, provider, model, total_rounds, completed_rounds,
                avg_attack_success, avg_defense_quality, avg_bypass_depth
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                campaign_data.get("campaign_id"),
                campaign_data.get("name"),
                campaign_data.get("state"),
                campaign_data.get("provider"),
                campaign_data.get("model"),
                campaign_data.get("total_rounds"),
                campaign_data.get("completed_rounds"),
                campaign_data.get("avg_attack_success"),
                campaign_data.get("avg_defense_quality"),
                campaign_data.get("avg_bypass_depth"),
            ),
        )
        conn.commit()

    def get_all_campaigns(self) -> list[dict[str, Any]]:
        conn = self._connect()
        rows = conn.execute("SELECT * FROM campaigns").fetchall()
        return [dict(row) for row in rows]
