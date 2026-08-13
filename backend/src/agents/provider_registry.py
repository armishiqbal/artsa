"""Backward-compatible re-exports of the dynamic LLM provider registry.

The factory registry (``register_provider`` / ``get_available_providers`` /
``create_llm_instance``) now lives in :mod:`src.services.provider_registry`
alongside the DB-backed credential registry, so there is a single home for
provider resolution. This module is kept as a compatibility shim for any code
that still imports the old ``src.agents.provider_registry`` path.
"""

from src.services.provider_registry import (
    ProviderFactory,
    create_llm_instance,
    get_available_providers,
    register_provider,
)

__all__ = [
    "ProviderFactory",
    "create_llm_instance",
    "get_available_providers",
    "register_provider",
]
