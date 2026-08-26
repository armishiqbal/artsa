"""In-memory registry of partner API key hashes → role.

Auth middleware is sync, so we resolve partner keys from this cache.
The store refreshes the cache on create / revoke / startup load.
"""

from __future__ import annotations

import hashlib
import threading
from typing import Any

from src.core.rbac import Role

_lock = threading.Lock()
# key_hash -> {id, name, role, tenant_id, enabled}
_HASH_INDEX: dict[str, dict[str, Any]] = {}


def hash_api_key(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def clear() -> None:
    with _lock:
        _HASH_INDEX.clear()


def replace_all(entries: list[dict[str, Any]]) -> None:
    """Replace the whole index (used on startup / full reload)."""
    with _lock:
        _HASH_INDEX.clear()
        for e in entries:
            if not e.get("enabled", True):
                continue
            h = e.get("key_hash")
            if not h:
                continue
            _HASH_INDEX[str(h)] = {
                "id": e.get("id"),
                "name": e.get("name"),
                "role": e.get("role") or "analyst",
                "tenant_id": e.get("tenant_id") or "default_org",
                "enabled": True,
            }


def upsert(entry: dict[str, Any]) -> None:
    h = entry.get("key_hash")
    if not h:
        return
    with _lock:
        if not entry.get("enabled", True):
            _HASH_INDEX.pop(str(h), None)
            return
        _HASH_INDEX[str(h)] = {
            "id": entry.get("id"),
            "name": entry.get("name"),
            "role": entry.get("role") or "analyst",
            "tenant_id": entry.get("tenant_id") or "default_org",
            "enabled": True,
        }


def remove_by_hash(key_hash: str) -> None:
    with _lock:
        _HASH_INDEX.pop(key_hash, None)


def has_any() -> bool:
    with _lock:
        return bool(_HASH_INDEX)


def resolve(raw_api_key: str | None) -> Role | None:
    """Return the Role for a partner key, or None if unknown."""
    if not raw_api_key:
        return None
    h = hash_api_key(raw_api_key)
    with _lock:
        meta = _HASH_INDEX.get(h)
    if not meta or not meta.get("enabled"):
        return None
    try:
        return Role(str(meta["role"]))
    except ValueError:
        return Role.ANALYST
