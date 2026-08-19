"""Persistence for local user accounts (email/password login).

Accounts can be stored in SQLite (original backend, used in tests) or MongoDB
(production source of truth, so accounts appear in Compass). Both backends sit
behind the :class:`UserStore` protocol; :func:`get_user_store` selects one at
runtime based on settings.
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.data.db import get_session_factory
from src.data.orm import UserORM


async def count_users(session: AsyncSession) -> int:
    return (await session.execute(select(func.count()).select_from(UserORM))).scalar() or 0


async def get_user_by_email(session: AsyncSession, email: str) -> UserORM | None:
    normalized = email.strip().lower()
    result = await session.execute(select(UserORM).where(UserORM.email == normalized))
    return result.scalar_one_or_none()


async def get_user_by_id(session: AsyncSession, user_id: str) -> UserORM | None:
    result = await session.execute(select(UserORM).where(UserORM.id == user_id))
    return result.scalar_one_or_none()


async def create_user(
    session: AsyncSession,
    *,
    email: str,
    password_hash: str,
    role: str = "admin",
    display_name: str = "",
    tenant_id: str = "default_org",
) -> UserORM:
    user = UserORM(
        id=str(uuid.uuid4()),
        email=email.strip().lower(),
        display_name=display_name.strip(),
        password_hash=password_hash,
        role=role,
        tenant_id=tenant_id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def update_user_profile(
    session: AsyncSession,
    user: UserORM,
    *,
    display_name: str | None = None,
    avatar: str | None = None,
    phone: str | None = None,
    location: str | None = None,
    organization: str | None = None,
) -> None:
    if display_name is not None:
        user.display_name = display_name.strip()
    if avatar is not None:
        user.avatar = avatar.strip() or None  # empty string clears the avatar
    if phone is not None:
        user.phone = phone.strip() or None
    if location is not None:
        user.location = location.strip() or None
    if organization is not None:
        user.organization = organization.strip() or None
    await session.commit()


async def update_password_hash(session: AsyncSession, user: UserORM, password_hash: str) -> None:
    user.password_hash = password_hash
    await session.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Shared account model + errors (backend-agnostic)
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class UserAccount:
    """A user account as returned by any :class:`UserStore` backend."""

    id: str
    email: str
    display_name: str = ""
    avatar: str | None = None
    phone: str | None = None
    location: str | None = None
    organization: str | None = None
    password_hash: str = ""
    role: str = "admin"
    tenant_id: str = "default_org"
    created_at: datetime | None = None
    updated_at: datetime | None = None


class UserStoreError(Exception):
    """Base class for account-store failures."""


class UserExistsError(UserStoreError):
    """An account with this email already exists (unique email violation)."""


class UserNotFoundError(UserStoreError):
    """No account with the given id exists."""


class UserStore(Protocol):
    """Account persistence contract shared by the SQLite and Mongo backends."""

    async def count_users(self) -> int: ...

    async def get_user_by_email(self, email: str) -> UserAccount | None: ...

    async def get_user_by_id(self, user_id: str) -> UserAccount | None: ...

    async def create_user(
        self,
        *,
        email: str,
        password_hash: str,
        role: str = "admin",
        display_name: str = "",
        tenant_id: str = "default_org",
    ) -> UserAccount: ...

    async def update_user_profile(
        self,
        user_id: str,
        *,
        display_name: str | None = None,
        avatar: str | None = None,
        phone: str | None = None,
        location: str | None = None,
        organization: str | None = None,
    ) -> UserAccount: ...

    async def set_avatar(self, user_id: str, avatar_path: str) -> UserAccount: ...

    async def update_password_hash(self, user_id: str, password_hash: str) -> None: ...


def _from_orm(user: UserORM) -> UserAccount:
    return UserAccount(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        avatar=user.avatar,
        phone=user.phone,
        location=user.location,
        organization=user.organization,
        password_hash=user.password_hash,
        role=user.role,
        tenant_id=user.tenant_id or "default_org",
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _parse_dt(value: Any) -> datetime | None:
    """Parse a stored timestamp into a tz-aware UTC datetime.

    Accepts ISO-8601 strings (with or without ``Z`` / ``+00:00``) and BSON
    ``datetime`` values; returns ``None`` for anything unparsable.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value)
        except ValueError:
            return None
        return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
    return None


# ─────────────────────────────────────────────────────────────────────────────
# SQLite backend (used in tests and as the no-Mongo fallback)
# ─────────────────────────────────────────────────────────────────────────────


class SqliteUserStore:
    """Account store backed by the SQLite ``users`` table (via the functions above)."""

    async def count_users(self) -> int:
        async with get_session_factory()() as session:
            return await count_users(session)

    async def get_user_by_email(self, email: str) -> UserAccount | None:
        async with get_session_factory()() as session:
            orm = await get_user_by_email(session, email)
            return _from_orm(orm) if orm is not None else None

    async def get_user_by_id(self, user_id: str) -> UserAccount | None:
        async with get_session_factory()() as session:
            orm = await get_user_by_id(session, user_id)
            return _from_orm(orm) if orm is not None else None

    async def create_user(
        self,
        *,
        email: str,
        password_hash: str,
        role: str = "admin",
        display_name: str = "",
        tenant_id: str = "default_org",
    ) -> UserAccount:
        async with get_session_factory()() as session:
            try:
                orm = await create_user(
                    session, email=email, password_hash=password_hash, role=role,
                    display_name=display_name, tenant_id=tenant_id,
                )
            except IntegrityError as exc:
                raise UserExistsError(email) from exc
            return _from_orm(orm)

    async def update_user_profile(
        self,
        user_id: str,
        *,
        display_name: str | None = None,
        avatar: str | None = None,
        phone: str | None = None,
        location: str | None = None,
        organization: str | None = None,
    ) -> UserAccount:
        async with get_session_factory()() as session:
            orm = await get_user_by_id(session, user_id)
            if orm is None:
                raise UserNotFoundError(user_id)
            await update_user_profile(
                session,
                orm,
                display_name=display_name,
                avatar=avatar,
                phone=phone,
                location=location,
                organization=organization,
            )
            return _from_orm(orm)

    async def set_avatar(self, user_id: str, avatar_path: str) -> UserAccount:
        return await self.update_user_profile(user_id, avatar=avatar_path)

    async def update_password_hash(self, user_id: str, password_hash: str) -> None:
        async with get_session_factory()() as session:
            orm = await get_user_by_id(session, user_id)
            if orm is None:
                raise UserNotFoundError(user_id)
            await update_password_hash(session, orm, password_hash)


# ─────────────────────────────────────────────────────────────────────────────
# MongoDB backend (production source of truth)
# ─────────────────────────────────────────────────────────────────────────────


def _mongo_enabled() -> bool:
    uri = (settings.ARTSA_MONGODB_URI or "").strip()
    return bool(uri) and uri.lower() != "disabled"


class MongoUserStore:
    """Account store backed by the MongoDB ``users`` collection.

    ``_id`` is the user id string (preserves ids through backfill). Timestamps
    are stored as ISO-8601 UTC strings to avoid BSON timezone coercion. Every
    pymongo call runs in a worker thread (``asyncio.to_thread``) because the
    sync client blocks the event loop.
    """

    def __init__(self, collection: Any | None = None) -> None:
        self._collection = collection  # injected fake in tests
        self._client: Any | None = None
        self._db: Any | None = None
        self._index_ensured = False

    def _get_collection(self) -> Any:
        if self._collection is not None:
            return self._collection
        if self._client is None:
            import pymongo

            self._client = pymongo.MongoClient(
                settings.ARTSA_MONGODB_URI,
                serverSelectionTimeoutMS=4000,
            )
            self._db = self._client[settings.ARTSA_MONGODB_DB]
        coll = self._db["users"]
        if not self._index_ensured:
            coll.create_index("email", unique=True)
            self._index_ensured = True
        return coll

    async def count_users(self) -> int:
        coll = self._get_collection()
        return int(await asyncio.to_thread(coll.count_documents, {}))

    async def get_user_by_email(self, email: str) -> UserAccount | None:
        coll = self._get_collection()
        doc = await asyncio.to_thread(coll.find_one, {"email": email.strip().lower()})
        return _from_doc(doc) if doc is not None else None

    async def get_user_by_id(self, user_id: str) -> UserAccount | None:
        coll = self._get_collection()
        doc = await asyncio.to_thread(coll.find_one, {"_id": user_id})
        return _from_doc(doc) if doc is not None else None

    async def create_user(
        self,
        *,
        email: str,
        password_hash: str,
        role: str = "admin",
        display_name: str = "",
        tenant_id: str = "default_org",
    ) -> UserAccount:
        coll = self._get_collection()
        user_id = str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        doc = {
            "_id": user_id,
            "email": email.strip().lower(),
            "display_name": display_name.strip(),
            "avatar": None,
            "phone": None,
            "location": None,
            "organization": None,
            "password_hash": password_hash,
            "role": role,
            "tenant_id": tenant_id,
            "created_at": now,
            "updated_at": now,
        }
        try:
            await asyncio.to_thread(coll.insert_one, doc)
        except Exception as exc:
            from pymongo.errors import DuplicateKeyError

            if isinstance(exc, DuplicateKeyError):
                raise UserExistsError(email) from exc
            raise
        return _from_doc(doc)

    async def update_user_profile(
        self,
        user_id: str,
        *,
        display_name: str | None = None,
        avatar: str | None = None,
        phone: str | None = None,
        location: str | None = None,
        organization: str | None = None,
    ) -> UserAccount:
        update: dict[str, Any] = {}
        if display_name is not None:
            update["display_name"] = display_name.strip()
        if avatar is not None:
            update["avatar"] = avatar.strip() or None  # empty string clears the avatar
        if phone is not None:
            update["phone"] = phone.strip() or None
        if location is not None:
            update["location"] = location.strip() or None
        if organization is not None:
            update["organization"] = organization.strip() or None
        update["updated_at"] = datetime.now(UTC).isoformat()
        import pymongo

        coll = self._get_collection()
        doc = await asyncio.to_thread(
            coll.find_one_and_update,
            {"_id": user_id},
            {"$set": update},
            return_document=pymongo.ReturnDocument.AFTER,
        )
        if doc is None:
            raise UserNotFoundError(user_id)
        return _from_doc(doc)

    async def set_avatar(self, user_id: str, avatar_path: str) -> UserAccount:
        return await self.update_user_profile(user_id, avatar=avatar_path)

    async def update_password_hash(self, user_id: str, password_hash: str) -> None:
        coll = self._get_collection()
        result = await asyncio.to_thread(
            coll.update_one,
            {"_id": user_id},
            {"$set": {"password_hash": password_hash, "updated_at": datetime.now(UTC).isoformat()}},
        )
        if result.matched_count == 0:
            raise UserNotFoundError(user_id)


def _from_doc(doc: Any) -> UserAccount:
    return UserAccount(
        id=str(doc.get("_id", "")),
        email=doc.get("email", ""),
        display_name=doc.get("display_name", "") or "",
        avatar=doc.get("avatar"),
        phone=doc.get("phone"),
        location=doc.get("location"),
        organization=doc.get("organization"),
        password_hash=doc.get("password_hash", "") or "",
        role=doc.get("role", "admin"),
        tenant_id=doc.get("tenant_id") or "default_org",
        created_at=_parse_dt(doc.get("created_at")),
        updated_at=_parse_dt(doc.get("updated_at")),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Selection + index hook
# ─────────────────────────────────────────────────────────────────────────────


def _select_user_store_class() -> type[UserStore]:
    """Pick the store: explicit override > tests/local SQLite > MongoDB > SQLite."""
    explicit = (settings.ARTSA_USER_STORE or "").strip().lower()
    if explicit == "sqlite":
        return SqliteUserStore
    if explicit == "mongo":
        return MongoUserStore
    if settings.is_testing:
        return SqliteUserStore
    if settings.USE_SQLITE:
        return SqliteUserStore
    if _mongo_enabled():
        return MongoUserStore
    return SqliteUserStore


_store_instances: dict[type[UserStore], UserStore] = {}


def get_user_store() -> UserStore:
    """Return a shared account store instance for the currently-selected backend."""
    cls = _select_user_store_class()
    if cls not in _store_instances:
        _store_instances[cls] = cls()
    return _store_instances[cls]


def ensure_user_indexes() -> None:
    """Create the unique ``email`` index on the Mongo ``users`` collection.

    Idempotent and a no-op when MongoDB is disabled. Called at startup and at the
    top of the SQLite→Mongo backfill script.
    """
    if not _mongo_enabled():
        return
    import pymongo

    client = pymongo.MongoClient(settings.ARTSA_MONGODB_URI, serverSelectionTimeoutMS=4000)
    try:
        db = client[settings.ARTSA_MONGODB_DB]
        db["users"].create_index("email", unique=True)
    finally:
        client.close()
