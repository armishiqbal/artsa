"""Hermetic tests for the pluggable account store — no live MongoDB required.

``MongoUserStore`` is exercised against a fake in-memory collection stub; store
selection is tested by monkeypatching settings. ``SqliteUserStore`` behaviour is
covered end-to-end by ``tests/test_password_auth.py``.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from pymongo.errors import DuplicateKeyError
from src.core.config import settings
from src.data.user_store import (
    MongoUserStore,
    SqliteUserStore,
    UserExistsError,
    UserNotFoundError,
    _parse_dt,
    get_user_store,
)


class _FakeResult:
    def __init__(self, matched_count: int = 0, upserted_id: object = None) -> None:
        self.matched_count = matched_count
        self.upserted_id = upserted_id


class FakeCollection:
    """Minimal in-memory stand-in for a pymongo Collection.

    Enforces a unique ``email`` constraint in place of the real unique index and
    implements the small slice of the pymongo API ``MongoUserStore`` uses.
    """

    def __init__(self) -> None:
        self.docs: dict[str, dict] = {}
        self.emails: set[str] = set()

    def find_one(self, query: dict) -> dict | None:
        for doc in self.docs.values():
            if all(doc.get(k) == v for k, v in query.items()):
                return dict(doc)
        return None

    def insert_one(self, doc: dict) -> None:
        if doc["email"] in self.emails:
            raise DuplicateKeyError("E11000 duplicate key error: email_1")
        self.emails.add(doc["email"])
        self.docs[doc["_id"]] = dict(doc)

    def count_documents(self, _filter: dict) -> int:
        return len(self.docs)

    def create_index(self, *_args, **_kwargs) -> str:
        return "email_1"

    def find_one_and_update(
        self, filter_: dict, update: dict, return_document: object = None
    ) -> dict | None:
        doc = self.docs.get(filter_["_id"])
        if doc is None:
            return None
        updated = dict(doc)
        updated.update(update["$set"])
        self.docs[filter_["_id"]] = updated
        return dict(updated)

    def update_one(self, filter_: dict, update: dict) -> _FakeResult:
        doc = self.docs.get(filter_["_id"])
        if doc is None:
            return _FakeResult(matched_count=0)
        updated = dict(doc)
        updated.update(update["$set"])
        self.docs[filter_["_id"]] = updated
        return _FakeResult(matched_count=1)


@pytest.fixture
def mongo_store() -> MongoUserStore:
    return MongoUserStore(collection=FakeCollection())


# ─────────────────────────────────────────────────────────────────────────────
# _parse_dt
# ─────────────────────────────────────────────────────────────────────────────


def test_parse_dt_handles_iso_zulu_and_bson():
    parsed = _parse_dt("2026-08-16T10:30:00Z")
    assert parsed is not None and parsed.tzinfo is not None
    assert parsed.hour == 10

    parsed = _parse_dt("2026-08-16T10:30:00+02:00")
    assert parsed is not None
    assert parsed.utcoffset().total_seconds() == 2 * 3600

    bson_dt = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
    parsed = _parse_dt(bson_dt)
    assert parsed == bson_dt and parsed.tzinfo is not None

    naive = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
    assert _parse_dt(naive).tzinfo is not None  # treated as UTC


def test_parse_dt_returns_none_for_garbage():
    assert _parse_dt(None) is None
    assert _parse_dt("not-a-date") is None
    assert _parse_dt(12345) is None


# ─────────────────────────────────────────────────────────────────────────────
# MongoUserStore CRUD
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_mongo_create_user_doc_shape(mongo_store):
    account = await mongo_store.create_user(
        email="  New@Example.COM ",
        password_hash="pbkdf2-hash",
        role="analyst",
        display_name=" New ",
    )
    assert account.email == "new@example.com"
    assert account.display_name == "New"
    assert account.role == "analyst"
    assert len(account.id) == 36
    assert account.created_at is not None and account.created_at.tzinfo is not None

    stored = mongo_store._collection.docs[account.id]
    assert stored["_id"] == account.id
    assert stored["email"] == "new@example.com"
    assert stored["password_hash"] == "pbkdf2-hash"
    assert stored["created_at"].endswith("+00:00")


@pytest.mark.asyncio
async def test_mongo_get_by_email_and_id_normalise(mongo_store):
    account = await mongo_store.create_user(email="a@b.com", password_hash="h")
    assert (await mongo_store.get_user_by_email(" A@B.com ")).id == account.id
    assert (await mongo_store.get_user_by_id(account.id)).email == "a@b.com"
    assert await mongo_store.get_user_by_email("nope@b.com") is None
    assert await mongo_store.get_user_by_id("missing") is None


@pytest.mark.asyncio
async def test_mongo_count_users_reflects_inserts(mongo_store):
    assert await mongo_store.count_users() == 0
    await mongo_store.create_user(email="a@b.com", password_hash="h")
    await mongo_store.create_user(email="c@d.com", password_hash="h")
    assert await mongo_store.count_users() == 2


@pytest.mark.asyncio
async def test_mongo_duplicate_email_raises_user_exists(mongo_store):
    await mongo_store.create_user(email="a@b.com", password_hash="h")
    with pytest.raises(UserExistsError):
        await mongo_store.create_user(email=" A@B.com ", password_hash="h2")


@pytest.mark.asyncio
async def test_mongo_update_profile_and_bump_updated_at(mongo_store):
    account = await mongo_store.create_user(email="a@b.com", password_hash="h")
    original_updated = account.updated_at
    updated = await mongo_store.update_user_profile(
        account.id, display_name="Renamed", phone="+1 555", location="Riyadh", organization="Labs"
    )
    assert updated.display_name == "Renamed"
    assert updated.phone == "+1 555"
    assert updated.location == "Riyadh"
    assert updated.organization == "Labs"
    assert updated.updated_at >= original_updated

    # Empty strings clear optional fields (mirrors the SQLite backend).
    cleared = await mongo_store.update_user_profile(account.id, phone="   ", organization="")
    assert cleared.phone is None
    assert cleared.organization is None
    assert cleared.display_name == "Renamed"  # untouched field preserved


@pytest.mark.asyncio
async def test_mongo_set_avatar_and_password(mongo_store):
    account = await mongo_store.create_user(email="a@b.com", password_hash="h")
    av = await mongo_store.set_avatar(account.id, "/api/v1/auth/me/avatar/x.png")
    assert av.avatar == "/api/v1/auth/me/avatar/x.png"
    await mongo_store.update_password_hash(account.id, "new-hash")
    assert (await mongo_store.get_user_by_id(account.id)).password_hash == "new-hash"


@pytest.mark.asyncio
async def test_mongo_missing_account_raises_not_found(mongo_store):
    with pytest.raises(UserNotFoundError):
        await mongo_store.update_user_profile("missing", display_name="x")
    with pytest.raises(UserNotFoundError):
        await mongo_store.update_password_hash("missing", "h")
    with pytest.raises(UserNotFoundError):
        await mongo_store.set_avatar("missing", "/p.png")


# ─────────────────────────────────────────────────────────────────────────────
# Store selection
# ─────────────────────────────────────────────────────────────────────────────


def test_selection_testing_prefers_sqlite(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "testing")
    monkeypatch.setattr(settings, "ARTSA_USER_STORE", None)
    assert isinstance(get_user_store(), SqliteUserStore)


def test_selection_explicit_override(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ARTSA_USER_STORE", "sqlite")
    assert isinstance(get_user_store(), SqliteUserStore)
    monkeypatch.setattr(settings, "ARTSA_USER_STORE", "mongo")
    assert isinstance(get_user_store(), MongoUserStore)


def test_selection_mongo_enabled_outside_testing(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ARTSA_USER_STORE", None)
    monkeypatch.setattr(settings, "USE_SQLITE", False)
    monkeypatch.setattr(settings, "ARTSA_MONGODB_URI", "mongodb://localhost:27017/artsa")
    assert isinstance(get_user_store(), MongoUserStore)


def test_selection_use_sqlite_overrides_configured_mongo(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ARTSA_USER_STORE", None)
    monkeypatch.setattr(settings, "USE_SQLITE", True)
    monkeypatch.setattr(settings, "ARTSA_MONGODB_URI", "mongodb://localhost:27017/artsa")
    assert isinstance(get_user_store(), SqliteUserStore)


def test_selection_falls_back_to_sqlite(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ARTSA_USER_STORE", None)
    monkeypatch.setattr(settings, "ARTSA_MONGODB_URI", None)
    assert isinstance(get_user_store(), SqliteUserStore)
