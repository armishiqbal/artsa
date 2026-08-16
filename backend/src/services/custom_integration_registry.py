"""In-memory cache of user-defined outbound integration connectors.

Mirrors :mod:`src.services.provider_registry`: the store persists connectors
with encrypted secrets; this registry holds the *decrypted* runtime view used
by the dispatch worker. Decrypted secrets live only in memory and are never
serialized into API responses.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from src.core.config import settings
from src.utils.crypto import decrypt_secret

logger = logging.getLogger(__name__)

SUPPORTED_EVENT_TYPES: tuple[str, ...] = (
    "alert",
    "tool_call",
    "proxy_call",
    "session_action",
)

SUPPORTED_AUTH_TYPES: tuple[str, ...] = (
    "none",
    "bearer",
    "basic",
    "api_key",
)

SUPPORTED_METHODS: tuple[str, ...] = ("POST", "PUT", "PATCH")


@dataclass
class CustomIntegration:
    """A decrypted, runtime-ready connector definition."""

    name: str
    target_url: str
    method: str = "POST"
    description: str | None = None
    auth_type: str = "none"
    headers: dict[str, str] = field(default_factory=dict)
    payload_template: str | None = None
    event_types: list[str] = field(default_factory=list)
    risk_threshold: float = 0.0
    enabled: bool = True
    retries: int = 3
    timeout: float = 10.0
    secrets: dict[str, str] = field(default_factory=dict)  # DECRYPTED — memory only


class CustomIntegrationRegistry:
    """In-memory cache of enabled connectors (read by the dispatch worker)."""

    def __init__(self) -> None:
        self._items: dict[str, CustomIntegration] = {}

    def load(self, rows: list[dict[str, Any]]) -> None:
        """Replace the cache from persisted rows (decrypted secrets)."""
        self._items = {}
        for row in rows:
            if not row.get("enabled", True):
                continue
            target_url = (row.get("target_url") or "").strip()
            if not target_url:
                continue
            name = row.get("name")
            if not name:
                continue
            secrets: dict[str, str] = {}
            for secret_name, ciphertext in (row.get("secrets") or {}).items():
                if not ciphertext:
                    continue
                try:
                    secrets[secret_name] = decrypt_secret(str(ciphertext), settings.SECRET_KEY)
                except Exception:
                    secrets[secret_name] = ""
            self._items[name] = CustomIntegration(
                name=name,
                target_url=target_url,
                method=(row.get("method") or "POST").upper(),
                description=row.get("description"),
                auth_type=(row.get("auth_type") or "none").lower(),
                headers=dict(row.get("headers") or {}),
                payload_template=row.get("payload_template"),
                event_types=list(row.get("event_types") or []),
                risk_threshold=float(row.get("risk_threshold") or 0.0),
                enabled=bool(row.get("enabled", True)),
                retries=int(row.get("retries") or 3),
                timeout=float(row.get("timeout") or 10.0),
                secrets=secrets,
            )
        logger.debug("Custom integration registry loaded %d connectors", len(self._items))

    def get(self, name: str | None) -> CustomIntegration | None:
        if not name:
            return None
        return self._items.get(name.strip().lower())

    def names(self) -> list[str]:
        return sorted(self._items.keys())

    def matching(self, event_type: str, risk: float) -> list[CustomIntegration]:
        """Return enabled connectors subscribed to this event type & risk band."""
        matched: list[CustomIntegration] = []
        for item in self._items.values():
            if not item.enabled:
                continue
            if event_type not in item.event_types:
                continue
            if risk < item.risk_threshold:
                continue
            matched.append(item)
        return matched

    async def refresh(self) -> None:
        """Reload the cache from the database.

        Queries the raw ORM rows directly (secrets as ciphertext) rather than
        going through :func:`integration_store.list_integrations` with
        ``include_secrets=True`` — that helper already decrypts, which would
        make :meth:`load` decrypt a second time and blank every secret.
        """
        try:
            from sqlalchemy import select

            from src.data.db import get_session_factory
            from src.data.orm import CustomIntegrationORM

            async with get_session_factory()() as session:
                rows = (
                    await session.execute(select(CustomIntegrationORM))
                ).scalars().all()
                self.load(
                    [
                        {
                            "name": r.name,
                            "target_url": r.target_url,
                            "method": r.method,
                            "description": r.description,
                            "auth_type": r.auth_type,
                            "headers": r.headers,
                            "payload_template": r.payload_template,
                            "event_types": r.event_types,
                            "risk_threshold": r.risk_threshold,
                            "enabled": r.enabled,
                            "retries": r.retries,
                            "timeout": r.timeout,
                            "secrets": r.secrets,  # raw ciphertext — load() decrypts
                        }
                        for r in rows
                    ]
                )
        except Exception as exc:  # pragma: no cover - registry must not crash startup
            logger.warning("Custom integration registry refresh skipped: %s", exc)


custom_integration_registry = CustomIntegrationRegistry()
