"""Local email/password authentication.

First registered user becomes the admin (bootstrap); afterwards new accounts can
only be created by an admin API key. Successful login/register issues a short-
lived HS256 session token (signed with SECRET_KEY) that the existing
``Authorization: Bearer`` path accepts.

Note: the API-key middleware keeps its fail-closed guard — a production box
still needs at least one role API key (or OIDC) configured alongside password
auth, otherwise non-public routes 503 by design.
"""

from __future__ import annotations

import re
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from src.api.dependencies import get_current_tenant, rate_limit_dependency
from src.core.auth_credentials import extract_bearer_token
from src.core.config import settings
from src.core.password_auth import (
    create_session_token,
    decode_session_token,
    password_auth_enabled,
)
from src.core.rbac import Role, resolve_role
from src.data.user_store import UserAccount, UserExistsError, UserStore, get_user_store
from src.utils.passwords import hash_password, verify_password

router = APIRouter(tags=["Authentication"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_AVATAR_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
_AVATAR_MAX_BYTES = 2 * 1024 * 1024  # 2 MB


def _avatars_dir() -> Path:
    """Directory holding uploaded avatars — under ARTSA_DATA_DIR (default ./data)."""
    return Path(settings.ARTSA_DATA_DIR) / "avatars"


class LoginPayload(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=256)


class RegisterPayload(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=256)
    display_name: str = Field(default="", max_length=255)
    role: str | None = Field(default=None, max_length=16)  # admin-API-key only


class ProfileUpdate(BaseModel):
    display_name: str = Field(default="", max_length=255)
    avatar: str | None = Field(default=None, max_length=512)  # emoji or uploaded image path
    phone: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    organization: str | None = Field(default=None, max_length=255)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)


def _session_response(user: UserAccount) -> dict:
    token = create_session_token(
        user.id,
        user.email,
        user.role,
        display_name=user.display_name,
        avatar=user.avatar,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": settings.ARTSA_SESSION_TTL_SEC,
        "user": {
            "email": user.email,
            "role": user.role,
            "display_name": user.display_name,
            "avatar": user.avatar,
            "phone": user.phone,
            "location": user.location,
            "organization": user.organization,
        },
        "auth_required": settings.auth_required,
        "oidc_enabled": settings.ARTSA_OIDC_ENABLED,
        "password_auth_enabled": password_auth_enabled(),
        "registration_open": False,
    }


def _ensure_password_auth_enabled() -> None:
    if not password_auth_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password login is disabled (enable ARTSA_PASSWORD_AUTH_ENABLED with a real SECRET_KEY)",
        )


async def _require_session_user(
    request: Request, store: UserStore
) -> UserAccount | None:
    """Resolve the local account from a valid password session token.

    Returns None (not an error) when there is no session token — callers turn
    that into a 401 so API-key/OIDC-only callers get a clean message.
    """
    bearer = extract_bearer_token(request.headers.get("Authorization"))
    claims = decode_session_token(bearer)
    if not claims:
        return None
    return await store.get_user_by_id(claims.get("sub"))


@router.get("/auth/status")
async def auth_status(store: UserStore = Depends(get_user_store)) -> dict:
    """Public bootstrap flag for the login screen (no emails or secrets)."""
    user_count = await store.count_users()
    return {
        "password_auth_enabled": password_auth_enabled(),
        "registration_open": user_count == 0,
        "has_admin": user_count > 0,
    }


@router.post("/auth/login")
async def login(
    payload: LoginPayload,
    request: Request,
    store: UserStore = Depends(get_user_store),
    _: None = Depends(rate_limit_dependency),
) -> dict:
    """Exchange email + password for a session token."""
    _ensure_password_auth_enabled()
    user = await store.get_user_by_email(payload.email)
    if user is None or not verify_password(payload.password, user.password_hash):
        # Same message for both failure modes — don't reveal whether an email exists.
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _session_response(user)


@router.post("/auth/register")
async def register(
    payload: RegisterPayload,
    request: Request,
    store: UserStore = Depends(get_user_store),
    tenant_id: str = Depends(get_current_tenant),
    _: None = Depends(rate_limit_dependency),
) -> dict:
    """Create a local account.

    Bootstrap: when no users exist the first registration creates the admin.
    Afterwards registration requires an admin API key (X-API-Key).
    The account is bound to the tenant from the X-Tenant-ID header.
    """
    _ensure_password_auth_enabled()
    if not _EMAIL_RE.match(payload.email.strip()):
        raise HTTPException(status_code=422, detail="Enter a valid email address")

    bootstrap = (await store.count_users()) == 0
    api_key = request.headers.get("X-API-Key")
    is_admin_key = resolve_role(api_key) == Role.ADMIN if api_key else False

    if not bootstrap and not is_admin_key:
        raise HTTPException(
            status_code=403,
            detail="Registration is closed. Ask an admin to create your account, or sign in.",
        )

    role = "admin"
    if is_admin_key and payload.role in (r.value for r in Role):
        role = payload.role  # an admin API key may specify analyst/redteam/readonly

    password_hash = hash_password(payload.password)
    try:
        user = await store.create_user(
            email=payload.email,
            password_hash=password_hash,
            role=role,
            display_name=payload.display_name,
            tenant_id=tenant_id,
        )
    except UserExistsError:
        raise HTTPException(status_code=409, detail="An account with that email already exists")

    return _session_response(user)


@router.get("/auth/me")
async def get_profile(
    request: Request,
    store: UserStore = Depends(get_user_store),
) -> dict:
    """Return the local account profile for the current password session."""
    user = await _require_session_user(request, store)
    if user is None:
        raise HTTPException(status_code=401, detail="No password session.")
    return {
        "email": user.email,
        "role": user.role,
        "display_name": user.display_name,
        "avatar": user.avatar,
        "phone": user.phone,
        "location": user.location,
        "organization": user.organization,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.patch("/auth/me")
async def update_profile(
    payload: ProfileUpdate,
    request: Request,
    store: UserStore = Depends(get_user_store),
) -> dict:
    """Update the editable profile fields for the current password session.

    Returns a fresh session response so the updated profile travels in the
    token claims and the frontend can store both token and profile atomically.
    """
    user = await _require_session_user(request, store)
    if user is None:
        raise HTTPException(status_code=401, detail="No password session.")
    user = await store.update_user_profile(
        user.id,
        display_name=payload.display_name,
        avatar=payload.avatar,
        phone=payload.phone,
        location=payload.location,
        organization=payload.organization,
    )
    return _session_response(user)


@router.post("/auth/me/password")
async def change_password(
    payload: PasswordChange,
    request: Request,
    store: UserStore = Depends(get_user_store),
) -> dict:
    """Change the password for the current password session (verifies the old one)."""
    user = await _require_session_user(request, store)
    if user is None:
        raise HTTPException(status_code=401, detail="No password session. Sign in to manage your profile.")
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    await store.update_password_hash(user.id, hash_password(payload.new_password))
    return {"status": "changed"}


@router.post("/auth/me/avatar")
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    store: UserStore = Depends(get_user_store),
) -> dict:
    """Upload a profile picture and return a fresh session response.

    The file is stored under ``backend/data/avatars/`` with an unguessable
    filename; ``user.avatar`` stores the serving path.
    """
    user = await _require_session_user(request, store)
    if user is None:
        raise HTTPException(status_code=401, detail="No password session.")

    ext = _AVATAR_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Avatar must be a PNG, JPEG, WebP, or GIF image.",
        )

    # Read the stream, aborting once the limit is crossed so we never buffer
    # a maliciously large upload.
    size = 0
    chunks: list[bytes] = []
    while chunk := await file.read(64 * 1024):
        size += len(chunk)
        if size > _AVATAR_MAX_BYTES:
            raise HTTPException(status_code=400, detail="Avatar image must be 2 MB or smaller.")
        chunks.append(chunk)
    if size == 0:
        raise HTTPException(status_code=400, detail="Avatar image is empty.")
    data = b"".join(chunks)

    avatars_dir = _avatars_dir()
    avatars_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{user.id}-{uuid4().hex}{ext}"
    (avatars_dir / filename).write_bytes(data)

    # Remove the previous uploaded file (never the emoji preset) to avoid litter.
    if user.avatar and user.avatar.startswith("/api/v1/auth/me/avatar/"):
        (avatars_dir / Path(user.avatar).name).unlink(missing_ok=True)

    user = await store.set_avatar(user.id, f"/api/v1/auth/me/avatar/{filename}")
    return _session_response(user)


@router.get("/auth/me/avatar/{filename}")
async def get_avatar(filename: str) -> FileResponse:
    """Serve an uploaded avatar image.

    Public by design — ``<img>`` tags can't send an Authorization header, and
    filenames are unguessable UUIDs. Basename-only resolution rejects traversal.
    """
    avatars_dir = _avatars_dir()
    if not filename or "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=404, detail="Not found")
    path = (avatars_dir / filename).resolve()
    if not str(path).startswith(str(avatars_dir.resolve())) or not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)
