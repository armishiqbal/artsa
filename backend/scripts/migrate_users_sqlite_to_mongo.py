#!/usr/bin/env python3
"""One-time migration: copy the SQLite ``users`` table into the MongoDB ``users`` collection.

MongoDB is now the source of truth for ARTSA user accounts. This script moves the
existing SQLite accounts (preserving ids, PBKDF2 password hashes and timestamps,
so existing logins keep working) into the configured MongoDB database, creating
the ``users`` collection and its unique email index.

Idempotent: re-running is a no-op identity write. Never modifies the SQLite table.

Usage:
    python scripts/migrate_users_sqlite_to_mongo.py [--db PATH]
"""

from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from datetime import UTC, datetime
from typing import Any

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.core.config import settings


def _parse_sqlite_dt(value: Any) -> str | None:
    """Normalise a SQLite stored timestamp to an ISO-8601 UTC string (Mongo format)."""
    if value is None:
        return None
    try:
        dt = datetime.fromisoformat(str(value))
    except ValueError:
        return str(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).isoformat()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=None, help="Path to the SQLite DB (default: from DATABASE_URL)")
    args = parser.parse_args()

    if settings.is_testing:
        print("Refusing to run under ENVIRONMENT=testing.", file=sys.stderr)
        return 1

    uri = (settings.ARTSA_MONGODB_URI or "").strip()
    if not uri or uri.lower() == "disabled":
        print("ARTSA_MONGODB_URI is not configured — nothing to migrate to.", file=sys.stderr)
        return 1

    db_path = args.db or settings.DATABASE_URL.split("///")[-1]
    if not os.path.exists(db_path):
        print(f"SQLite DB not found: {db_path}", file=sys.stderr)
        return 1

    import pymongo

    con = sqlite3.connect(db_path)
    try:
        rows = con.execute(
            "SELECT id, email, display_name, avatar, phone, location, organization, "
            "password_hash, role, created_at, updated_at FROM users"
        ).fetchall()
    finally:
        con.close()

    if not rows:
        print("No users in the SQLite users table — nothing to migrate.")
        return 0

    # Unique email index on the Mongo users collection (idempotent).
    from src.data.user_store import ensure_user_indexes

    ensure_user_indexes()
    client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=4000)
    try:
        coll = client[settings.ARTSA_MONGODB_DB]["users"]
        upserted, replaced = 0, 0
        for row in rows:
            (user_id, email, display_name, avatar, phone, location,
             organization, password_hash, role, created_at, updated_at) = row
            doc = {
                "_id": user_id,
                "email": (email or "").strip().lower(),
                "display_name": display_name or "",
                "avatar": avatar,
                "phone": phone,
                "location": location,
                "organization": organization,
                "password_hash": password_hash,
                "role": role or "admin",
                "created_at": _parse_sqlite_dt(created_at),
                "updated_at": _parse_sqlite_dt(updated_at),
            }
            result = coll.replace_one({"_id": user_id}, doc, upsert=True)
            if result.upserted_id is not None:
                upserted += 1
                print(f"  upserted {email} | {user_id}")
            else:
                replaced += 1
                print(f"  replaced {email} | {user_id}")
        print(f"\nDone: {upserted} inserted, {replaced} already present "
              f"(total {len(rows)}) in db={settings.ARTSA_MONGODB_DB} collection=users")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
