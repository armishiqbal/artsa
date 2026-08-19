"""Tests for local email/password authentication.

Covers password hashing, session-token signing, the login/register endpoints
(bootstrap admin + admin-key gated registration), and that a session token is
accepted by the existing Bearer-auth path (/config/me and a protected route).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from src.core.password_auth import create_session_token, decode_session_token
from src.utils.passwords import hash_password, verify_password

from tests.conftest import unwrap_response


@pytest.fixture
def password_api(monkeypatch, tmp_path):
    """Isolated DB + clean app, password auth enabled with a known signing key."""
    db = tmp_path / "test_auth.db"
    monkeypatch.setattr("src.core.config.settings.DATABASE_URL", f"sqlite+aiosqlite:///{db}")
    monkeypatch.setattr("src.core.config.settings.SYNC_DATABASE_URL", f"sqlite:///{db}")
    monkeypatch.setattr("src.data.db._engine", None)
    monkeypatch.setattr("src.data.db._session_factory", None)
    monkeypatch.setattr("src.core.config.settings.SECRET_KEY", "test-signing-key-0123456789abcdef" * 2)
    monkeypatch.setattr("src.core.config.settings.ARTSA_PASSWORD_AUTH_ENABLED", True)
    monkeypatch.setattr("src.core.config.settings.ARTSA_API_KEY", "admin-api-key-12345")
    # Account store: keep tests on the SQLite backend (hermetic — no MongoDB).
    monkeypatch.setattr("src.core.config.settings.ARTSA_USER_STORE", "sqlite")
    # Avatars land under ARTSA_DATA_DIR so the tmp_path assertions hold.
    monkeypatch.setattr("src.core.config.settings.ARTSA_DATA_DIR", str(tmp_path))

    from src.data.orm import Base

    sync_engine = create_engine(f"sqlite:///{db}")
    Base.metadata.create_all(sync_engine)
    sync_engine.dispose()

    from src.api.main import create_app

    return TestClient(create_app())


def _seed_user(db_path, email, password, role="admin"):
    """Insert a user directly via the store (bypasses the API)."""
    import asyncio

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from src.data.user_store import create_user

    async def _insert():
        engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
        try:
            factory = async_sessionmaker(engine, expire_on_commit=False)
            async with factory() as session:
                return await create_user(
                    session, email=email, password_hash=hash_password(password), role=role
                )
        finally:
            await engine.dispose()

    return asyncio.run(_insert())


# ─────────────────────────────────────────────────────────────────────────────
# Password hashing
# ─────────────────────────────────────────────────────────────────────────────


def test_hash_verify_roundtrip():
    stored = hash_password("s3cret-password")
    assert stored.startswith("pbkdf2_sha256$600000$")
    assert verify_password("s3cret-password", stored) is True


def test_verify_wrong_password():
    stored = hash_password("right-password")
    assert verify_password("wrong-password", stored) is False


def test_verify_salts_are_unique():
    assert hash_password("same-pass") != hash_password("same-pass")


@pytest.mark.parametrize("garbage", ["", "not-a-hash", "pbkdf2_sha256$x$y", None])
def test_verify_malformed_stored_hash(garbage):
    assert verify_password("anything", garbage) is False


# ─────────────────────────────────────────────────────────────────────────────
# Session tokens
# ─────────────────────────────────────────────────────────────────────────────


def test_session_token_roundtrip(password_api):
    token = create_session_token("u1", "admin@example.com", "admin")
    claims = decode_session_token(token)
    assert claims is not None
    assert claims["email"] == "admin@example.com"
    assert claims["role"] == "admin"


def test_session_token_expired_rejected(password_api):
    token = create_session_token("u1", "a@b.com", "admin", ttl_sec=-10)
    assert decode_session_token(token) is None


def test_session_token_garbage_rejected(password_api):
    assert decode_session_token("not.a.jwt") is None


# ─────────────────────────────────────────────────────────────────────────────
# Login endpoint
# ─────────────────────────────────────────────────────────────────────────────


def _register_bootstrap(password_api) -> None:
    res = password_api.post(
        "/api/v1/auth/register",
        json={"email": "admin@example.com", "password": "long-enough-pass", "display_name": "Haroon"},
    )
    assert res.status_code in (200, 201)


def test_login_accepts_valid_credentials(password_api, tmp_path):
    db = tmp_path / "test_auth.db"
    _seed_user(db, "admin@example.com", "correct-horse")

    res = password_api.post(
        "/api/v1/auth/login", json={"email": "admin@example.com", "password": "correct-horse"}
    )
    assert res.status_code == 200
    body = unwrap_response(res)
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["role"] == "admin"
    assert body["password_auth_enabled"] is True

    # The session token works through the existing Bearer path.
    me = unwrap_response(
        password_api.get("/api/v1/config/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    )
    assert me["authenticated"] is True
    assert me["role"] == "admin"
    assert me["auth_method"] == "password"

    # And it authorizes a protected route.
    keys = password_api.get(
        "/api/v1/config/keys", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert keys.status_code == 200


def test_login_wrong_password_401(password_api, tmp_path):
    db = tmp_path / "test_auth.db"
    _seed_user(db, "admin@example.com", "correct-horse")
    res = password_api.post(
        "/api/v1/auth/login", json={"email": "admin@example.com", "password": "nope"}
    )
    assert res.status_code == 401


def test_login_unknown_email_401(password_api):
    res = password_api.post(
        "/api/v1/auth/login", json={"email": "ghost@example.com", "password": "anything"}
    )
    assert res.status_code == 401


def test_login_disabled_403(password_api, monkeypatch):
    monkeypatch.setattr("src.core.config.settings.ARTSA_PASSWORD_AUTH_ENABLED", False)
    res = password_api.post(
        "/api/v1/auth/login", json={"email": "a@b.com", "password": "whatever-pass"}
    )
    assert res.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# Register endpoint
# ─────────────────────────────────────────────────────────────────────────────


def test_register_bootstrap_creates_admin(password_api):
    res = password_api.post(
        "/api/v1/auth/register",
        json={"email": "admin@example.com", "password": "long-enough-pass", "display_name": "Haroon"},
    )
    assert res.status_code in (200, 201)
    body = unwrap_response(res)
    assert body["user"]["role"] == "admin"
    assert body["access_token"]


def test_register_duplicate_email_409(password_api):
    _register_bootstrap(password_api)
    # An admin key is required to reach the duplicate check — without one the
    # route returns 403 (registration closed) before looking up the email.
    res = password_api.post(
        "/api/v1/auth/register",
        headers={"X-API-Key": "admin-api-key-12345"},
        json={"email": "admin@example.com", "password": "another-pass-here"},
    )
    assert res.status_code == 409


def test_register_after_bootstrap_requires_admin_key(password_api):
    _register_bootstrap(password_api)
    res = password_api.post(
        "/api/v1/auth/register", json={"email": "other@example.com", "password": "another-pass-here"}
    )
    assert res.status_code == 403


def test_register_with_admin_key_creates_role(password_api):
    _register_bootstrap(password_api)
    res = password_api.post(
        "/api/v1/auth/register",
        headers={"X-API-Key": "admin-api-key-12345"},
        json={
            "email": "analyst@example.com",
            "password": "another-pass-here",
            "role": "analyst",
        },
    )
    assert res.status_code in (200, 201)
    body = unwrap_response(res)
    assert body["user"]["role"] == "analyst"


def test_register_invalid_email_422(password_api):
    res = password_api.post(
        "/api/v1/auth/register", json={"email": "not-an-email", "password": "long-enough-pass"}
    )
    assert res.status_code == 422


def test_register_short_password_422(password_api):
    res = password_api.post(
        "/api/v1/auth/register", json={"email": "a@b.com", "password": "short"}
    )
    assert res.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# Profile endpoints (/auth/me, /auth/me/password)
# ─────────────────────────────────────────────────────────────────────────────


def _profile_session(password_api) -> str:
    """Register the bootstrap admin and return a fresh session token."""
    res = password_api.post(
        "/api/v1/auth/register",
        json={"email": "profile@example.com", "password": "long-enough-pass", "display_name": "Prof"},
    )
    assert res.status_code in (200, 201)
    return unwrap_response(res)["access_token"]


def test_get_me_returns_profile(password_api):
    token = _profile_session(password_api)
    res = password_api.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    body = unwrap_response(res)
    assert body["email"] == "profile@example.com"
    assert body["role"] == "admin"
    assert body["display_name"] == "Prof"


def test_get_me_without_session_401(password_api):
    assert password_api.get("/api/v1/auth/me").status_code == 401


def test_patch_me_updates_display_name_and_issues_token(password_api):
    token = _profile_session(password_api)
    res = password_api.patch(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"display_name": "Updated Name"},
    )
    assert res.status_code == 200
    body = unwrap_response(res)
    assert body["user"]["display_name"] == "Updated Name"
    assert body["access_token"]

    # The freshly issued token carries the updated display name.
    me = unwrap_response(
        password_api.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
        )
    )
    assert me["display_name"] == "Updated Name"


def test_change_password_wrong_current_401(password_api):
    token = _profile_session(password_api)
    res = password_api.post(
        "/api/v1/auth/me/password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "wrong-pass", "new_password": "brand-new-pass"},
    )
    assert res.status_code == 401


def test_change_password_updates_and_new_password_works(password_api):
    token = _profile_session(password_api)
    res = password_api.post(
        "/api/v1/auth/me/password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "long-enough-pass", "new_password": "brand-new-pass"},
    )
    assert res.status_code == 200
    assert unwrap_response(res)["status"] == "changed"

    # Old password no longer works.
    old = password_api.post(
        "/api/v1/auth/login", json={"email": "profile@example.com", "password": "long-enough-pass"}
    )
    assert old.status_code == 401

    # New password does.
    new = password_api.post(
        "/api/v1/auth/login", json={"email": "profile@example.com", "password": "brand-new-pass"}
    )
    assert new.status_code == 200


def test_change_password_short_new_422(password_api):
    token = _profile_session(password_api)
    res = password_api.post(
        "/api/v1/auth/me/password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "long-enough-pass", "new_password": "short"},
    )
    assert res.status_code == 422


def test_patch_me_updates_extra_profile_fields(password_api):
    token = _profile_session(password_api)
    res = password_api.patch(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "display_name": "Prof Updated",
            "phone": "+1 555 0100",
            "location": "Riyadh, SA",
            "organization": "ARTSA Labs",
        },
    )
    assert res.status_code == 200
    body = unwrap_response(res)
    assert body["user"]["phone"] == "+1 555 0100"
    assert body["user"]["location"] == "Riyadh, SA"
    assert body["user"]["organization"] == "ARTSA Labs"

    me = unwrap_response(
        password_api.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
        )
    )
    assert me["phone"] == "+1 555 0100"
    assert me["location"] == "Riyadh, SA"
    assert me["organization"] == "ARTSA Labs"


def test_patch_me_empty_strings_clear_optional_fields(password_api):
    token = _profile_session(password_api)
    password_api.patch(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"phone": "123", "location": "x", "organization": "y"},
    )
    res = password_api.patch(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"phone": "   ", "location": "", "organization": ""},
    )
    assert res.status_code == 200
    me = unwrap_response(
        password_api.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    )
    assert me["phone"] is None
    assert me["location"] is None
    assert me["organization"] is None


_PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"0" * 128


def test_avatar_upload_sets_path_and_serves_file(password_api, tmp_path):
    token = _profile_session(password_api)
    res = password_api.post(
        "/api/v1/auth/me/avatar",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("avatar.png", _PNG_BYTES, "image/png")},
    )
    assert res.status_code == 200
    body = unwrap_response(res)
    avatar = body["user"]["avatar"]
    assert avatar.startswith("/api/v1/auth/me/avatar/")

    # Stored next to the isolated test DB.
    filename = avatar.rsplit("/", 1)[-1]
    assert (tmp_path / "avatars" / filename).read_bytes() == _PNG_BYTES

    # Served back with any valid credential — the BFF proxy injects the server
    # API key for <img> loads (which can't send an Authorization header).
    served = password_api.get(avatar, headers={"X-API-Key": "admin-api-key-12345"})
    assert served.status_code == 200
    assert served.content == _PNG_BYTES


def test_avatar_upload_replaces_previous_file(password_api, tmp_path):
    token = _profile_session(password_api)
    first = unwrap_response(
        password_api.post(
            "/api/v1/auth/me/avatar",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("a.png", _PNG_BYTES, "image/png")},
        )
    )["user"]["avatar"]
    second = unwrap_response(
        password_api.post(
            "/api/v1/auth/me/avatar",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("b.png", b"\x89PNG\r\n\x1a\nzz", "image/png")},
        )
    )["user"]["avatar"]
    assert first != second
    old = tmp_path / "avatars" / first.rsplit("/", 1)[-1]
    new = tmp_path / "avatars" / second.rsplit("/", 1)[-1]
    assert not old.exists()  # old upload cleaned up
    assert new.exists()


def test_avatar_upload_rejects_non_image(password_api):
    token = _profile_session(password_api)
    res = password_api.post(
        "/api/v1/auth/me/avatar",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("notes.txt", b"not an image", "text/plain")},
    )
    assert res.status_code == 415


def test_avatar_upload_rejects_oversize(password_api):
    token = _profile_session(password_api)
    big = b"\x89PNG\r\n\x1a\n" + b"0" * (2 * 1024 * 1024 + 1)
    res = password_api.post(
        "/api/v1/auth/me/avatar",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("big.png", big, "image/png")},
    )
    assert res.status_code == 400


def test_avatar_upload_requires_session(password_api):
    res = password_api.post(
        "/api/v1/auth/me/avatar",
        files={"file": ("avatar.png", _PNG_BYTES, "image/png")},
    )
    assert res.status_code == 401


def test_avatar_serve_rejects_traversal_and_missing(password_api):
    key = {"X-API-Key": "admin-api-key-12345"}
    assert password_api.get("/api/v1/auth/me/avatar/evil..txt", headers=key).status_code == 404
    assert password_api.get("/api/v1/auth/me/avatar/no-such-file.png", headers=key).status_code == 404


def test_avatar_serve_requires_a_valid_credential(password_api):
    assert password_api.get("/api/v1/auth/me/avatar/anything.png").status_code == 401
