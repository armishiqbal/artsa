"""Target registry persistence, tenant scoping, and discovery derivation."""

from __future__ import annotations

import tempfile

import pytest
from src.core.models.targets import TargetCreate, TargetUpdate


@pytest.fixture
async def session():
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from src.data.db import Base
    from src.data.orm import TargetORM  # noqa: F401 — register the table

    # Fresh temp file: create_all does not alter pre-existing dev schemas.
    url = "sqlite+aiosqlite:///" + tempfile.mktemp(suffix="_targets_test.db")
    engine = create_async_engine(url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        yield s

    await engine.dispose()


def _payload(name: str = "Support bot", **kwargs) -> TargetCreate:
    defaults = {
        "kind": "agent",
        "version": "v1",
        "provider": "openai",
        "model": "gpt-4o-mini",
    }
    defaults.update(kwargs)
    return TargetCreate(name=name, **defaults)


@pytest.mark.asyncio
async def test_create_and_get_target(session):
    from src.data import target_store

    created = await target_store.create_target(session, _payload(), tenant_id="acme")

    assert created.name == "Support bot"
    assert created.tenant_id == "acme"
    # Targets are unauthorized until an operator explicitly clears them.
    assert created.authorized is False
    assert created.surface is None

    fetched = await target_store.get_target(session, created.id, tenant_id="acme")
    assert fetched is not None
    assert fetched.id == created.id


@pytest.mark.asyncio
async def test_targets_are_tenant_scoped(session):
    from src.data import target_store

    mine = await target_store.create_target(session, _payload("Acme bot"), tenant_id="acme")

    # A different tenant can neither list nor fetch nor delete it.
    assert await target_store.list_targets(session, tenant_id="globex") == []
    assert await target_store.get_target(session, mine.id, tenant_id="globex") is None
    assert await target_store.delete_target(session, mine.id, tenant_id="globex") is False

    assert len(await target_store.list_targets(session, tenant_id="acme")) == 1


@pytest.mark.asyncio
async def test_same_name_allowed_across_tenants(session):
    from src.data import target_store

    await target_store.create_target(session, _payload("Shared name"), tenant_id="acme")

    assert await target_store.name_exists(session, "Shared name", tenant_id="acme") is True
    assert await target_store.name_exists(session, "Shared name", tenant_id="globex") is False

    # Uniqueness is per tenant, so this must not raise.
    other = await target_store.create_target(
        session, _payload("Shared name"), tenant_id="globex"
    )
    assert other.tenant_id == "globex"


@pytest.mark.asyncio
async def test_changing_target_config_invalidates_surface(session):
    from src.core.models.targets import Capability, TargetSurface
    from src.data import target_store

    target = await target_store.create_target(session, _payload(), tenant_id="acme")
    await target_store.save_surface(
        session,
        target.id,
        TargetSurface(
            reachable=True,
            probes_run=6,
            capabilities=[Capability(id="tools", present=True, confidence=0.9)],
        ),
        tenant_id="acme",
    )

    stored = await target_store.get_target(session, target.id, tenant_id="acme")
    assert stored is not None and stored.surface is not None
    assert stored.discovered_at is not None

    # Swapping the model means the old surface no longer describes this target.
    updated = await target_store.update_target(
        session, target.id, TargetUpdate(model="gpt-4o"), tenant_id="acme"
    )
    assert updated is not None
    assert updated.surface is None
    assert updated.discovered_at is None


@pytest.mark.asyncio
async def test_renaming_keeps_surface(session):
    from src.core.models.targets import TargetSurface
    from src.data import target_store

    target = await target_store.create_target(session, _payload(), tenant_id="acme")
    await target_store.save_surface(
        session, target.id, TargetSurface(reachable=True, probes_run=6), tenant_id="acme"
    )

    # A label change does not change what the system is.
    updated = await target_store.update_target(
        session, target.id, TargetUpdate(name="Renamed"), tenant_id="acme"
    )
    assert updated is not None
    assert updated.name == "Renamed"
    assert updated.surface is not None


@pytest.mark.asyncio
async def test_discovery_refuses_unauthorized_target(session):
    from src.data import target_store
    from src.discovery import TargetNotAuthorizedError, discover_target

    target = await target_store.create_target(session, _payload(), tenant_id="acme")
    assert target.authorized is False

    with pytest.raises(TargetNotAuthorizedError):
        await discover_target(target)


@pytest.mark.asyncio
async def test_unreachable_target_reports_unknown_not_empty(session, monkeypatch):
    """An unreachable target has an *unknown* surface, never a clean bill of health."""
    from src.data import target_store
    from src.discovery import discover_target

    target = await target_store.create_target(
        session,
        _payload(authorized=True, provider="deterministic", model="echo"),
        tenant_id="acme",
    )

    def _boom(_config):
        raise RuntimeError("no credentials configured")

    monkeypatch.setattr("src.agents.target_agent.TargetAgent", _boom)

    surface = await discover_target(target)
    assert surface.reachable is False
    assert "no credentials" in (surface.unreachable_reason or "")
    assert surface.capabilities == []
    assert surface.surface == []


def test_discovery_config_resolves_tenant_provider_alias(monkeypatch):
    import src.services.provider_resolver as resolver_module
    from src.core.models.targets import Target
    from src.discovery.engine import _build_target_config
    from src.services.provider_resolver import ResolvedProvider

    calls: dict[str, object] = {}

    def resolve_sync(**kwargs):
        calls.update(kwargs)
        return ResolvedProvider(
            tenant_id="acme",
            provider_id="provider-row-123",
            provider_name="acme-openai",
            provider_type="openai",
            api_key="must-not-enter-target-config",
            base_url="https://api.openai.com/v1",
            model="gpt-4o-mini",
            source="database",
        )

    monkeypatch.setattr(resolver_module.provider_resolver, "resolve_sync", resolve_sync)
    target = Target(
        id="target-1",
        tenant_id="acme",
        name="Support bot",
        provider="acme-openai",
        model="gpt-4o-mini",
        version="v2",
        authorized=True,
    )

    config = _build_target_config(target)

    assert calls["tenant_id"] == "acme"
    assert calls["provider"] == "acme-openai"
    assert config.provider == "openai"
    assert config.provider_ref == "provider-row-123"
    assert config.target_id == "target-1"
    assert config.target_version == "v2"
    assert "api_key" not in config.model_dump()


@pytest.mark.asyncio
async def test_target_preflight_checks_authorization_provider_and_discovery(monkeypatch):
    import src.api.routes.targets as targets_route
    from src.api.routes.targets import target_campaign_preflight
    from src.core.models.targets import Target, TargetSurface
    from src.services.provider_resolver import ResolvedProvider

    target = Target(
        id="target-1",
        tenant_id="acme",
        name="Support bot",
        provider="acme-openai",
        model="gpt-4o-mini",
        authorized=True,
        surface=TargetSurface(reachable=True),
    )

    async def get_target(_session, target_id, *, tenant_id):
        assert target_id == target.id
        assert tenant_id == "acme"
        return target

    async def resolve_async(_session, **kwargs):
        assert kwargs["tenant_id"] == "acme"
        assert kwargs["provider"] == "acme-openai"
        return ResolvedProvider(
            tenant_id="acme",
            provider_id="provider-row-123",
            provider_name="acme-openai",
            provider_type="openai",
            api_key="secret",
            base_url="https://api.openai.com/v1",
            model="gpt-4o-mini",
            source="database",
        )

    monkeypatch.setattr(targets_route.target_store, "get_target", get_target)
    monkeypatch.setattr(targets_route.provider_resolver, "resolve_async", resolve_async)

    result = await target_campaign_preflight("target-1", object(), "acme")

    assert result["ready"] is True
    assert {check["id"]: check["ready"] for check in result["checks"]} == {
        "authorization": True,
        "provider": True,
        "discovery": True,
    }


@pytest.mark.asyncio
async def test_campaign_target_gate_requires_authorization_and_reachable_discovery(monkeypatch):
    import src.data.target_store as target_store_module
    from fastapi import HTTPException
    from src.api.routes.campaigns import RunCampaignRequest, _apply_registered_target
    from src.core.models.targets import Target, TargetSurface

    target = Target(
        id="target-1",
        tenant_id="acme",
        name="Support bot",
        provider="acme-openai",
        model="gpt-4o-mini",
        authorized=True,
        surface=TargetSurface(reachable=False),
    )

    async def get_target(_session, _target_id, *, tenant_id):
        assert tenant_id == "acme"
        return target

    monkeypatch.setattr(target_store_module, "get_target", get_target)
    request = RunCampaignRequest(target_id=target.id)

    with pytest.raises(HTTPException) as error:
        await _apply_registered_target(request, object(), "acme")

    assert error.value.status_code == 409
    assert "discovery" in str(error.value.detail).lower()

    target.authorized = False
    with pytest.raises(HTTPException) as error:
        await _apply_registered_target(request, object(), "acme")
    assert error.value.status_code == 403
