"""Authenticated, privacy-preserving AI Security Playground routes."""

from __future__ import annotations

import json
import time
import uuid
from collections.abc import AsyncIterator
from typing import Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import AliasChoices, BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_tenant, get_db, get_redis, get_session_tracker
from src.core.config import settings
from src.data.orm import ProviderORM
from src.gateway.llm_proxy import get_llm_proxy
from src.runtime.actions import RuntimeAction
from src.runtime.disclosure import fingerprint_from_messages
from src.runtime.evidence import RedactedFinding, sha256_text
from src.runtime.gate import RuntimeDecision, get_runtime_gate
from src.runtime.stream import AnthropicStreamGate, OpenAIStreamGate, fail_closed_decision
from src.services.approval_service import consume_retry_token
from src.services.playground import PlaygroundEvaluator, get_playground_evaluator
from src.services.playground_security import (
    action_for_verdict,
    budget_snapshot,
    enforce_chat_budget,
    public_findings,
    record_run,
    redact_prompt_scan,
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


def _template(evaluator: PlaygroundEvaluator, template_id: str | None, tenant_id: str | None = None) -> dict[str, Any] | None:
    if not template_id:
        return None
    from src.api.routes.attack_library import _load_builtin_templates, _load_custom_templates

    template = next((item for item in _load_builtin_templates() if str(item.get("id", "")) == template_id), None)
    if template is None and tenant_id:
        # Custom attack templates are tenant-owned.  Legacy rows without an
        # owner are intentionally unavailable to the authenticated playground.
        template = next((item for item in _load_custom_templates() if str(item.get("id", "")) == template_id and item.get("tenant_id") == tenant_id), None)
    if template_id and template is None:
        raise HTTPException(status_code=404, detail="attack_template_not_found")
    return template


def _content(evaluator: PlaygroundEvaluator, system_prompt: str, text: str, template_id: str | None, tenant_id: str | None = None) -> str:
    return evaluator.build_content(system_prompt, text, _template(evaluator, template_id, tenant_id))


def _actor_id(request: Request, tenant_id: str) -> str:
    """Return a stable non-secret actor label for per-user quota accounting."""
    authorization = request.headers.get("Authorization", "")
    if authorization.lower().startswith("bearer "):
        try:
            from src.core.password_auth import decode_session_token

            claims = decode_session_token(authorization[7:].strip())
            if claims and claims.get("sub"):
                return str(claims["sub"])
        except Exception:
            # Continue with the API-key digest or tenant fallback below; the
            # failed bearer token is never reflected in quota/audit metadata.
            authorization = ""
    api_key = request.headers.get("X-API-Key")
    if api_key:
        # Never persist or log the caller key; a short digest is sufficient to
        # keep independent API-key callers in separate quota buckets.
        return f"key:{sha256_text(api_key)[:16]}"
    return f"tenant:{tenant_id}"


def _prompt_runtime_decision(scan: Any, *, content: str, action: RuntimeAction) -> RuntimeDecision:
    body_sha = sha256_text(content)
    findings = [
        RedactedFinding(
            detector=str(getattr(event, "detector", "PromptScanner")),
            category=str(getattr(event, "category", getattr(event, "event_type", "PROMPT_INJECTION"))),
            body_sha256=body_sha,
            action=action,
            span_start=int(getattr(event, "span_start", 0) or 0),
            span_end=int(getattr(event, "span_end", 0) or 0),
        )
        for event in (scan.security_events or [])
    ]
    return RuntimeDecision(action=action, findings=findings, body_sha256=body_sha)


def _consume_playground_retry(redis: Any, token: str | None, *, tenant_id: str, session_id: uuid.UUID, operation: dict[str, Any]) -> bool:
    if not token:
        return False
    try:
        authorized = consume_retry_token(
            redis,
            token,
            tenant_id=tenant_id,
            session_id=session_id,
            tool_name="playground.chat",
            arguments=operation,
        )
    except Exception as exc:
        # Redis is the single-use boundary.  A production outage must not
        # become an accidental retry allowance or a credential-bearing 500.
        if settings.ENVIRONMENT == "production":
            raise HTTPException(status_code=503, detail="approval_store_unavailable") from exc
        raise HTTPException(status_code=403, detail="invalid_or_used_approval_retry_token") from exc
    if not authorized:
        raise HTTPException(status_code=403, detail="invalid_or_used_approval_retry_token")
    return True


def _effective_message(evaluator: PlaygroundEvaluator, message: str, template: dict[str, Any] | None) -> str:
    template_text = str((template or {}).get("template") or "").strip()
    if not template_text:
        return message
    return f"{template_text}\n\n{message}"


async def _catalog_templates(tenant_id: str | None = None) -> list[dict[str, Any]]:
    from src.api.routes.attack_library import _load_builtin_templates, _load_custom_templates

    output: list[dict[str, Any]] = []
    custom = [item for item in _load_custom_templates() if tenant_id and item.get("tenant_id") == tenant_id]
    for item in _load_builtin_templates() + custom:
        if not item.get("id"):
            continue
        output.append({
            "id": str(item["id"]), "name": item.get("name") or "Untitled template",
            "category": item.get("category") or "other",
            "description": item.get("description") or (item.get("metadata") or {}).get("description") or "",
        })
    return output


@router.get("/playground/catalog")
async def playground_catalog(db: AsyncSession = Depends(get_db), redis=Depends(get_redis), tenant_id: str = Depends(get_current_tenant)) -> dict[str, Any]:
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
        "templates": await _catalog_templates(tenant_id),
        "budget": budget_snapshot(redis, tenant_id=tenant_id),
    }


@router.post("/playground/scan")
async def playground_scan(request: Request, payload: PlaygroundScanRequest, db: AsyncSession = Depends(get_db), tenant_id: str = Depends(get_current_tenant)) -> dict[str, Any]:
    """Direct guard tester. It cannot contact an LLM."""
    if not payload.content.strip() and not payload.template_id:
        raise HTTPException(status_code=422, detail="content_required")
    started = time.monotonic()
    evaluator = get_playground_evaluator()
    content, session_id = _content(evaluator, payload.system_prompt, payload.content, payload.template_id, tenant_id), _sid(payload.session_id)
    if payload.channel == "input":
        scan = evaluator._scanner.scan(content, session_id=session_id, agent_id="playground")
        action, findings, result = action_for_verdict(scan.verdict.verdict), scan.security_events, redact_prompt_scan(scan, channel=payload.channel)
        result["latency_ms"] = max(0, int((time.monotonic() - started) * 1000))
    else:
        # Output and tool-result channels scan only the untrusted body.  The
        # system prompt is reference material for disclosure detection, never
        # part of the body being classified as leaked content.
        fingerprint = fingerprint_from_messages(
            ([{"role": "system", "content": payload.system_prompt}] if payload.system_prompt.strip() else []),
        )
        output_body = evaluator.build_content("", payload.content, _template(evaluator, payload.template_id, tenant_id))
        decision = get_runtime_gate().evaluate(
            output_text=output_body,
            fingerprint=fingerprint,
            session_id=session_id,
            untrusted_tool_result=payload.channel == "tool_result",
        )
        action, findings = decision.action, decision.findings
        result = {
            "channel": payload.channel,
            "body_sha256": decision.body_sha256,
            "action": action.value,
            "findings": public_findings(findings),
            "verdict": "BREACHED" if action == RuntimeAction.BLOCK else "SUSPICIOUS" if action == RuntimeAction.QUARANTINE else "SAFE",
            "risk_score": 100.0 if action == RuntimeAction.BLOCK else 70.0 if action == RuntimeAction.QUARANTINE else 0.0,
            "risk_breakdown": {"rule_based": 100.0 if action == RuntimeAction.BLOCK else 70.0 if action == RuntimeAction.QUARANTINE else 0.0},
            "fired_detectors": {finding.detector: True for finding in findings},
            "latency_ms": max(0, int((time.monotonic() - started) * 1000)),
        }
    await record_run(db, tenant_id=tenant_id, actor_id=_actor_id(request, tenant_id), session_id=session_id, mode="scan", channel=payload.channel, request_body=content, response_body=None, action=action, findings=findings)
    await db.commit()
    return {"session_id": str(session_id), "action": action.value, "result": result}


@router.post("/playground/chat", response_model=None)
async def playground_chat(
    request: Request,
    payload: PlaygroundChatRequest,
    x_artsa_approval_retry_token: str | None = Header(None, alias="X-ARTSA-Approval-Retry-Token"),
    db: AsyncSession = Depends(get_db), redis=Depends(get_redis), tracker=Depends(get_session_tracker), tenant_id: str = Depends(get_current_tenant),
) -> Any:
    """Text-only provider simulator. Input and output are independently gated."""
    from src.api.routes.proxy import (
        _ensure_proxy_session,
        _queue_quarantine_approval,
        _record_output_decision,
    )

    evaluator = get_playground_evaluator()
    template = _template(evaluator, payload.template_id, tenant_id)
    effective_message = _effective_message(evaluator, payload.message, template)
    content, session_id = evaluator.build_content(payload.system_prompt, effective_message, None), _sid(payload.session_id)
    actor_id = _actor_id(request, tenant_id)
    await _ensure_proxy_session(db, tracker, session_id, tenant_id)
    from src.api.routes.proxy import _circuit_breaker_error, _circuit_breaker_open

    if await _circuit_breaker_open(db, tenant_id=tenant_id, session_id=session_id):
        return JSONResponse(status_code=403, content=_circuit_breaker_error(session_id), headers={"X-ARTSA-Session-ID": str(session_id)})
    scan = evaluator._scanner.scan(content, session_id=session_id, agent_id="playground")
    input_action = action_for_verdict(scan.verdict.verdict)
    operation = {
        "provider_ref": payload.provider_ref,
        "model": payload.model,
        "content_sha256": sha256_text(content),
        "mode": payload.mode,
    }
    retry_authorized = _consume_playground_retry(redis, x_artsa_approval_retry_token, tenant_id=tenant_id, session_id=session_id, operation=operation)
    if payload.mode == "block" and input_action == RuntimeAction.BLOCK:
        decision = _prompt_runtime_decision(scan, content=content, action=RuntimeAction.BLOCK)
        await _record_output_decision(decision, session_id, db=db, tenant_id=tenant_id)
        await record_run(db, tenant_id=tenant_id, actor_id=actor_id, session_id=session_id, mode=payload.mode, channel="chat", request_body=content, response_body=None, action=input_action, findings=decision.findings)
        await db.commit()
        return JSONResponse(status_code=403, content={"code": "input_blocked", "session_id": str(session_id), "action": input_action.value, "evidence": redact_prompt_scan(scan, channel="input")})
    if payload.mode == "block" and input_action == RuntimeAction.QUARANTINE and not retry_authorized:
        decision = _prompt_runtime_decision(scan, content=content, action=RuntimeAction.QUARANTINE)
        approval = await _queue_quarantine_approval(db=db, tracker=tracker, tenant_id=tenant_id, session_id=session_id, decision=decision, tool_name="playground.chat", arguments=operation, requester={"surface": "playground", "actor_id": actor_id})
        await record_run(db, tenant_id=tenant_id, actor_id=actor_id, session_id=session_id, mode=payload.mode, channel="chat", request_body=content, response_body=None, action=input_action, findings=decision.findings)
        await db.commit()
        return JSONResponse(status_code=403, content={"code": "approval_required", "approval_id": approval.id, "session_id": str(session_id), "action": "QUARANTINE", "evidence": redact_prompt_scan(scan, channel="input")})

    try:
        resolved = None
        if payload.provider_ref:
            resolved = await provider_resolver.resolve_async(db, tenant_id=tenant_id, provider=None, provider_ref=payload.provider_ref, model=payload.model)
        elif settings.ENVIRONMENT == "production":
            raise ProviderConfigurationError("provider_not_configured")
    except ProviderConfigurationError as exc:
        raise HTTPException(status_code=422, detail=exc.code) from exc

    # Reserve quota only after configuration resolution.  A missing/disabled
    # provider should return its typed configuration error without consuming a
    # tenant request or token allowance.
    await enforce_chat_budget(db, tenant_id=tenant_id, actor_id=actor_id, redis=redis, estimated_input_tokens=max(1, len(content) // 4))

    messages: list[dict[str, str]] = ([{"role": "system", "content": payload.system_prompt}] if payload.system_prompt.strip() else []) + [{"role": "user", "content": effective_message}]

    async def events() -> AsyncIterator[str]:
        started = time.monotonic()
        yield _sse("playground.status", {"stage": "input_screened", "session_id": str(session_id), "action": input_action.value, "would_block": payload.mode == "monitor" and input_action != RuntimeAction.ALLOW})
        if resolved is None:
            text = "Simulated response: no live provider is configured."
            decision = get_runtime_gate().evaluate(output_text=text, session_id=session_id)
            yield _sse("message.delta", {"text": text})
            yield _sse("playground.complete", {"action": decision.action.value, "simulated": True, "body_sha256": decision.body_sha256, "findings": public_findings(decision.findings)})
            await record_run(db, tenant_id=tenant_id, actor_id=actor_id, session_id=session_id, mode=payload.mode, channel="chat", request_body=content, response_body=text, action=decision.action, findings=decision.findings, estimated_tokens=True, input_tokens=max(1, len(content) // 4), output_tokens=max(1, len(text) // 4), started_at=started)
            await db.commit()
            return
        proxy = get_llm_proxy()
        is_anthropic = resolved.provider_type.lower() == "anthropic"
        if is_anthropic:
            request_payload: dict[str, Any] = {"model": resolved.model, "messages": [{"role": "user", "content": effective_message}], "stream": True, "max_tokens": settings.ARTSA_PLAYGROUND_MAX_OUTPUT_TOKENS}
            if payload.system_prompt.strip():
                request_payload["system"] = payload.system_prompt
            gate: Any = AnthropicStreamGate(messages=request_payload["messages"], session_id=session_id, extra_system=payload.system_prompt, model=resolved.model, retry_authorized=retry_authorized, allow_tools=False)
            upstream_url = f"{resolved.base_url.rstrip('/')}/messages"
        else:
            request_payload = {"model": resolved.model, "messages": messages, "stream": True, "max_tokens": settings.ARTSA_PLAYGROUND_MAX_OUTPUT_TOKENS, "tools": []}
            gate = OpenAIStreamGate(messages=messages, session_id=session_id, retry_authorized=retry_authorized, allow_tools=False)
            upstream_url = f"{resolved.base_url.rstrip('/')}/chat/completions"
        yield _sse("playground.status", {"stage": "provider_streaming", "provider_id": resolved.provider_id, "model": resolved.model})
        try:
            extra_headers = {"x-api-key": resolved.api_key, "anthropic-version": "2023-06-01"} if is_anthropic and resolved.api_key else {}
            async for raw in proxy.stream_chat(upstream_url, request_payload, resolved.api_key, extra_headers):
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
                yield _sse("playground.approval_required", {"approval_id": approval.id, "session_id": str(session_id), "action": "QUARANTINE", "body_sha256": decision.body_sha256, "findings": public_findings(decision.findings)})
            else:
                await _record_output_decision(decision, session_id, db=db, tenant_id=tenant_id)
                if decision.action == RuntimeAction.BLOCK:
                    yield _sse("playground.blocked", {"code": "output_blocked", "action": "BLOCK", "body_sha256": decision.body_sha256, "findings": public_findings(decision.findings)})
                else:
                    yield _sse("playground.complete", {"action": decision.action.value, "body_sha256": decision.body_sha256, "findings": public_findings(decision.findings)})
            await record_run(db, tenant_id=tenant_id, actor_id=actor_id, session_id=session_id, mode=payload.mode, channel="chat", request_body=content, response_body=gate.state.text if decision.action == RuntimeAction.ALLOW else None, action=decision.action, findings=decision.findings, provider_id=resolved.provider_id, model=resolved.model, estimated_tokens=True, input_tokens=max(1, len(content) // 4), output_tokens=max(0, len(gate.state.text) // 4), started_at=started)
            await db.commit()
        except Exception:
            decision = fail_closed_decision(stream=True)
            await _record_output_decision(decision, session_id, db=db, tenant_id=tenant_id)
            yield _sse("playground.blocked", {"code": "playground_upstream_unavailable", "action": "BLOCK", "findings": public_findings(decision.findings)})
            await record_run(db, tenant_id=tenant_id, actor_id=actor_id, session_id=session_id, mode=payload.mode, channel="chat", request_body=content, response_body=None, action=RuntimeAction.BLOCK, findings=decision.findings, provider_id=resolved.provider_id, model=resolved.model, started_at=started)
            await db.commit()

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-store", "X-ARTSA-Session-ID": str(session_id)})


@router.post("/playground/evaluate")
async def playground_evaluate_legacy(request: Request, payload: PlaygroundScanRequest, db: AsyncSession = Depends(get_db), tenant_id: str = Depends(get_current_tenant)) -> dict[str, Any]:
    """Deprecated compatibility route; it no longer reflects raw text."""
    # Legacy callers receive the same digest-only scan contract.
    return await playground_scan(request, payload, db, tenant_id)


@router.get("/playground/templates")
async def playground_templates_legacy(db: AsyncSession = Depends(get_db), tenant_id: str = Depends(get_current_tenant)) -> dict[str, Any]:
    templates = await _catalog_templates(tenant_id)
    return {"templates": templates, "total_templates": len(templates)}
