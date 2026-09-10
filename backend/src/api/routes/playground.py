"""Authenticated, privacy-preserving AI Security Playground routes."""

from __future__ import annotations

import hashlib
import json
import time
import uuid
from collections.abc import AsyncIterator
from typing import Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import AliasChoices, BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_tenant, get_db, get_redis, get_session_tracker
from src.core.config import settings
from src.data.orm import ProviderORM
from src.gateway.llm_proxy import get_llm_proxy
from src.runtime.actions import RuntimeAction
from src.runtime.evidence import RedactedFinding
from src.runtime.gate import get_runtime_gate
from src.runtime.stream import OpenAIStreamGate
from src.services.approval_service import consume_retry_token
from src.services.playground import PlaygroundEvaluator, get_playground_evaluator
from src.services.playground_security import (
    action_for_verdict, enforce_chat_budget, public_findings, record_run, redact_prompt_scan,
)
from src.services.provider_resolver import ProviderConfigurationError, provider_resolver

router = APIRouter(tags=["AI Security Playground"])
_MAX_SYSTEM_CHARS = 8_192
_MAX_CONTENT_CHARS = 16_384


class PlaygroundScanRequest(BaseModel):
    system_prompt: str = Field(default="", max_length=_MAX_SYSTEM_CHARS)
    content: str = Field(default="", max_length=_MAX_CONTENT_CHARS, validation_alias=AliasChoices("content", "user_input"))
    channel: Literal["input", "model_output", "tool_result"] = "input"
    template_id: str | None = Field(default=None, max_length=128)
    session_id: str | None = Field(default=None, max_length=36)


class PlaygroundChatRequest(BaseModel):
    system_prompt: str = Field(default="", max_length=_MAX_SYSTEM_CHARS)
    message: str = Field(..., min_length=1, max_length=_MAX_CONTENT_CHARS)
    provider_ref: str | None = Field(default=None, max_length=64)
    model: str | None = Field(default=None, max_length=128)
    template_id: str | None = Field(default=None, max_length=128)
    mode: Literal["block", "monitor"] = "block"
    session_id: str | None = Field(default=None, max_length=36)

    @field_validator("model")
    @classmethod
    def clean_model(cls, value: str | None) -> str | None:
        return value.strip() if value and value.strip() else None


def _sid(value: str | None) -> uuid.UUID:
    try:
        return uuid.UUID(value or "")
    except (ValueError, TypeError):
        return uuid.uuid4()


def _sse(event: str, body: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(body, separators=(',', ':'))}\n\n"


def _template(evaluator: PlaygroundEvaluator, template_id: str | None) -> dict[str, Any] | None:
    template = evaluator.resolve_template(template_id)
    if template_id and template is None:
        raise HTTPException(status_code=404, detail="attack_template_not_found")
    return template


def _content(evaluator: PlaygroundEvaluator, system_prompt: str, text: str, template_id: str | None) -> str:
    return evaluator.build_content(system_prompt, text, _template(evaluator, template_id))


async def _catalog_templates() -> list[dict[str, Any]]:
    from src.api.routes.attack_library import _load_builtin_templates, _load_custom_templates

    output: list[dict[str, Any]] = []
    for item in _load_builtin_templates() + _load_custom_templates():
        if not item.get("id"):
            continue
        output.append({
            "id": str(item["id"]), "name": item.get("name") or "Untitled template",
            "category": item.get("category") or "other",
            "description": item.get("description") or (item.get("metadata") or {}).get("description") or "",
            "template": item.get("template") or "",
        })
    return output


@router.get("/playground/catalog")
async def playground_catalog(db: AsyncSession = Depends(get_db), tenant_id: str = Depends(get_current_tenant)) -> dict[str, Any]:
    # Unit-test dependency sessions deliberately have no SQL surface. They
    # represent the no-provider state; production never takes this fallback.
    if not hasattr(db, "execute") and settings.is_testing:
        providers = []
    else:
        providers = list((await db.execute(select(ProviderORM).where(
            ProviderORM.tenant_id == tenant_id, ProviderORM.enabled.is_(True)
        ))).scalars())
    return {
        "providers": [{"id": p.id, "name": p.name, "provider_type": p.provider_type, "default_model": p.default_model} for p in providers],
        "templates": await _catalog_templates(),
        "budget": {"daily_requests": settings.ARTSA_PLAYGROUND_TENANT_DAILY_REQUESTS, "daily_tokens": settings.ARTSA_PLAYGROUND_TENANT_DAILY_TOKENS, "max_output_tokens": settings.ARTSA_PLAYGROUND_MAX_OUTPUT_TOKENS},
    }


@router.post("/playground/scan")
async def playground_scan(payload: PlaygroundScanRequest, db: AsyncSession = Depends(get_db), tenant_id: str = Depends(get_current_tenant)) -> dict[str, Any]:
    """Direct guard tester. It cannot contact an LLM."""
    if not payload.content.strip() and not payload.template_id:
        raise HTTPException(status_code=422, detail="content_required")
    evaluator = get_playground_evaluator()
    content, session_id = _content(evaluator, payload.system_prompt, payload.content, payload.template_id), _sid(payload.session_id)
    if payload.channel == "input":
        scan = evaluator._scanner.scan(content, session_id=session_id, agent_id="playground")
        action, findings, result = action_for_verdict(scan.verdict.verdict), scan.security_events, redact_prompt_scan(scan, channel=payload.channel)
    else:
        decision = get_runtime_gate().evaluate(output_text=content, session_id=session_id, untrusted_tool_result=payload.channel == "tool_result")
        action, findings = decision.action, decision.findings
        result = {"channel": payload.channel, "body_sha256": decision.body_sha256, "action": action.value, "findings": public_findings(findings), "verdict": "BREACHED" if action == RuntimeAction.BLOCK else "SUSPICIOUS" if action == RuntimeAction.QUARANTINE else "SAFE"}
    await record_run(db, tenant_id=tenant_id, actor_id=None, session_id=session_id, mode="scan", channel=payload.channel, request_body=content, response_body=None, action=action, findings=findings)
    await db.commit()
    return {"session_id": str(session_id), "action": action.value, "result": result}


@router.post("/playground/chat", response_model=None)
async def playground_chat(
    payload: PlaygroundChatRequest,
    x_artsa_approval_retry_token: str | None = Header(None, alias="X-ARTSA-Approval-Retry-Token"),
    db: AsyncSession = Depends(get_db), redis=Depends(get_redis), tracker=Depends(get_session_tracker), tenant_id: str = Depends(get_current_tenant),
) -> Any:
    """Text-only provider simulator. Input and output are independently gated."""
    from src.api.routes.proxy import _ensure_proxy_session, _queue_quarantine_approval, _record_output_decision

    evaluator = get_playground_evaluator()
    content, session_id = _content(evaluator, payload.system_prompt, payload.message, payload.template_id), _sid(payload.session_id)
    await _ensure_proxy_session(db, tracker, session_id, tenant_id)
    scan = evaluator._scanner.scan(content, session_id=session_id, agent_id="playground")
    input_action = action_for_verdict(scan.verdict.verdict)
    operation = {"provider_ref": payload.provider_ref, "model": payload.model, "content_sha256": hashlib.sha256(content.encode()).hexdigest(), "mode": payload.mode}
    retry_authorized = bool(x_artsa_approval_retry_token) and consume_retry_token(redis, x_artsa_approval_retry_token, tenant_id=tenant_id, session_id=session_id, tool_name="playground.chat", arguments=operation)
    if x_artsa_approval_retry_token and not retry_authorized:
        raise HTTPException(status_code=403, detail="invalid_or_used_approval_retry_token")
    if payload.mode == "block" and input_action == RuntimeAction.BLOCK:
        await record_run(db, tenant_id=tenant_id, actor_id=None, session_id=session_id, mode=payload.mode, channel="chat", request_body=content, response_body=None, action=input_action, findings=scan.security_events)
        await db.commit()
        return JSONResponse(status_code=403, content={"code": "input_blocked", "session_id": str(session_id), "action": input_action.value, "evidence": redact_prompt_scan(scan, channel="input")})
    if payload.mode == "block" and input_action == RuntimeAction.QUARANTINE and not retry_authorized:
        findings = [RedactedFinding(detector=getattr(e, "detector", "PromptScanner"), category=getattr(e, "event_type", "PROMPT_INJECTION"), body_sha256=hashlib.sha256(content.encode()).hexdigest(), action=RuntimeAction.QUARANTINE) for e in scan.security_events]
        decision = type("Decision", (), {"findings": findings, "action": RuntimeAction.QUARANTINE})()
        approval = await _queue_quarantine_approval(db=db, tracker=tracker, tenant_id=tenant_id, session_id=session_id, decision=decision, tool_name="playground.chat", arguments=operation, requester={"surface": "playground"})
        await record_run(db, tenant_id=tenant_id, actor_id=None, session_id=session_id, mode=payload.mode, channel="chat", request_body=content, response_body=None, action=input_action, findings=findings)
        await db.commit()
        return JSONResponse(status_code=403, content={"code": "approval_required", "approval_id": approval.id, "session_id": str(session_id), "action": "QUARANTINE", "evidence": redact_prompt_scan(scan, channel="input")})

    await enforce_chat_budget(db, tenant_id=tenant_id, actor_id=None)
    try:
        if not payload.provider_ref:
            raise ProviderConfigurationError("provider_not_configured")
        resolved = await provider_resolver.resolve_async(db, tenant_id=tenant_id, provider=None, provider_ref=payload.provider_ref, model=payload.model)
    except ProviderConfigurationError as exc:
        if settings.ENVIRONMENT == "production":
            raise HTTPException(status_code=422, detail=exc.code) from exc
        resolved = None

    messages: list[dict[str, str]] = ([{"role": "system", "content": payload.system_prompt}] if payload.system_prompt.strip() else []) + [{"role": "user", "content": payload.message}]

    async def events() -> AsyncIterator[str]:
        started = time.monotonic()
        yield _sse("playground.status", {"stage": "input_screened", "session_id": str(session_id), "action": input_action.value, "would_block": payload.mode == "monitor" and input_action != RuntimeAction.ALLOW})
        if resolved is None:
            text = "Simulated response: no live provider is configured."
            decision = get_runtime_gate().evaluate(output_text=text, session_id=session_id)
            yield _sse("message.delta", {"text": text})
            yield _sse("playground.complete", {"action": decision.action.value, "simulated": True, "findings": public_findings(decision.findings)})
            await record_run(db, tenant_id=tenant_id, actor_id=None, session_id=session_id, mode=payload.mode, channel="chat", request_body=content, response_body=text, action=decision.action, findings=decision.findings, estimated_tokens=True, input_tokens=max(1, len(content) // 4), output_tokens=max(1, len(text) // 4), started_at=started)
            await db.commit()
            return
        proxy = get_llm_proxy()
        request_payload = {"model": resolved.model, "messages": messages, "stream": True, "max_tokens": settings.ARTSA_PLAYGROUND_MAX_OUTPUT_TOKENS, "tools": []}
        gate = OpenAIStreamGate(messages=messages, session_id=session_id, retry_authorized=retry_authorized)
        yield _sse("playground.status", {"stage": "provider_streaming", "provider_id": resolved.provider_id, "model": resolved.model})
        try:
            async for raw in proxy.stream_chat(f"{resolved.base_url.rstrip('/')}/chat/completions", request_payload, resolved.api_key, {}):
                for frame in gate.feed(raw.decode("utf-8", errors="replace")):
                    yield frame
                if gate.aborted:
                    break
            if not gate.aborted:
                for frame in gate.finish():
                    yield frame
            decision = gate.final_decision or get_runtime_gate().evaluate(output_text="", session_id=session_id, stream=True)
            if decision.action == RuntimeAction.QUARANTINE and not retry_authorized:
                approval = await _queue_quarantine_approval(db=db, tracker=tracker, tenant_id=tenant_id, session_id=session_id, decision=decision, tool_name="playground.chat", arguments=operation, requester={"surface": "playground", "provider_id": resolved.provider_id})
                yield _sse("playground.approval_required", {"approval_id": approval.id, "session_id": str(session_id), "action": "QUARANTINE", "findings": public_findings(decision.findings)})
            else:
                await _record_output_decision(decision, session_id, db=db, tenant_id=tenant_id)
                yield _sse("playground.complete", {"action": decision.action.value, "findings": public_findings(decision.findings)})
            await record_run(db, tenant_id=tenant_id, actor_id=None, session_id=session_id, mode=payload.mode, channel="chat", request_body=content, response_body=gate.state.text, action=decision.action, findings=decision.findings, provider_id=resolved.provider_id, model=resolved.model, estimated_tokens=True, input_tokens=max(1, len(content) // 4), output_tokens=max(0, len(gate.state.text) // 4), started_at=started)
            await db.commit()
        except Exception:
            decision = get_runtime_gate().evaluate(output_text="", session_id=session_id, stream=True)
            yield _sse("playground.blocked", {"code": "playground_upstream_unavailable", "action": "BLOCK", "findings": public_findings(decision.findings)})
            await record_run(db, tenant_id=tenant_id, actor_id=None, session_id=session_id, mode=payload.mode, channel="chat", request_body=content, response_body=None, action=RuntimeAction.BLOCK, findings=decision.findings, provider_id=resolved.provider_id, model=resolved.model, started_at=started)
            await db.commit()

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-store", "X-ARTSA-Session-ID": str(session_id)})


@router.post("/playground/evaluate")
async def playground_evaluate_legacy(payload: PlaygroundScanRequest, db: AsyncSession = Depends(get_db), tenant_id: str = Depends(get_current_tenant)) -> dict[str, Any]:
    """Deprecated compatibility route; it no longer reflects raw text."""
    return await playground_scan(payload, db, tenant_id)


@router.get("/playground/templates")
async def playground_templates_legacy(db: AsyncSession = Depends(get_db), tenant_id: str = Depends(get_current_tenant)) -> dict[str, Any]:
    templates = await _catalog_templates()
    return {"templates": templates, "total_templates": len(templates)}
