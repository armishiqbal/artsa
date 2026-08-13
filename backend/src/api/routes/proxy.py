"""Detection-gated LLM reverse proxy routes (OpenAI & Anthropic compatible).

Exposed under both ``/v1/proxy/...`` and ``/api/v1/proxy/...`` so developers
can set ``base_url=http://localhost:8000/v1/proxy`` in any OpenAI/Anthropic
client and get containment enforcement transparently.
"""

from __future__ import annotations

import json
import time
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Body, Header, HTTPException, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

from src.core.config import settings
from src.gateway.llm_proxy import ProxyAction, get_llm_proxy

router = APIRouter(tags=["LLM Proxy"])


def _sse(data: dict[str, Any], event: str | None = None) -> str:
    """Format a server-sent-event payload."""
    payload = json.dumps(data)
    if event:
        return f"event: {event}\ndata: {payload}\n\n"
    return f"data: {payload}\n\n"


def _openai_block_error(scan: dict[str, Any]) -> dict[str, Any]:
    return {
        "error": {
            "message": (
                f"ARTSA containment: prompt blocked (risk {scan['risk_score']:.1f}, "
                f"verdict {scan['verdict']}). Flags: {', '.join(scan['flags']) or 'none'}."
            ),
            "type": "artsa_containment_block",
            "param": None,
            "code": "prompt_blocked",
            "artsa": scan,
        }
    }


def _anthropic_block_error(scan: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "error",
        "error": {
            "type": "forbidden_error",
            "message": (
                f"ARTSA containment: prompt blocked (risk {scan['risk_score']:.1f}, "
                f"verdict {scan['verdict']})."
            ),
            "artsa": scan,
        },
    }


def _request_session_id(request: Request) -> uuid.UUID:
    try:
        return uuid.UUID(request.headers.get("X-ARTSA-Session-ID", ""))
    except (ValueError, TypeError):
        return uuid.uuid4()


async def _handle_decision(
    request: Request,
    content: str,
    provider: str,
    model: str,
    stream: bool,
) -> dict[str, Any] | None:
    """Evaluate prompt content. Returns a block error dict, or None to forward.

    Side effects: publishes telemetry, records containment alerts on block.
    """
    proxy = get_llm_proxy()
    start = time.perf_counter()
    session_id = _request_session_id(request)
    action, scan = proxy.decide(content, session_id=session_id)

    proxy.publish_telemetry(
        action=action,
        scan=scan,
        provider=provider,
        model=model,
        stream=stream,
        latency_ms=(time.perf_counter() - start) * 1000,
        session_id=session_id,
    )

    if action == ProxyAction.BLOCK:
        proxy.record_blocked_alert(scan)
        return scan.to_dict()
    return None


@router.get("/proxy/health")
async def proxy_health() -> dict[str, Any]:
    """Proxy status endpoint (also used by SDK health checks)."""
    from src.gateway.provider_catalog import PROVIDER_CATALOG

    return {
        "status": "ok",
        "enabled": settings.ARTSA_PROXY_ENABLED,
        "mode": settings.ARTSA_PROXY_MODE,
        "block_threshold": settings.ARTSA_PROXY_BLOCK_THRESHOLD,
        "default_provider": settings.ARTSA_PROXY_DEFAULT_PROVIDER,
        "target_base_url": settings.ARTSA_PROXY_TARGET_BASE_URL,
        "providers": sorted(PROVIDER_CATALOG.keys()),
        # Trust contract: how the guardrail behaves and its latency budget.
        "fail_mode": settings.ARTSA_PROXY_FAIL_MODE,
        "latency_slo_ms": settings.EDS_LATENCY_THRESHOLD_MS,
        "version": "1.0",
    }


@router.post("/proxy/chat/completions")
async def proxy_chat_completions_short(
    request: Request,
    payload: dict[str, Any] = Body(...),
    x_artsa_provider: str | None = Header(None, alias="X-ARTSA-Provider"),
    x_artsa_forward_to: str | None = Header(None, alias="X-ARTSA-Forward-To"),
) -> Response:
    """Alias for ``/proxy/v1/chat/completions``.

    The OpenAI SDK appends ``/chat/completions`` to ``base_url``. Pointing a
    client at ``base_url=http://localhost:8000/v1/proxy`` therefore resolves
    here (``/v1/proxy/chat/completions``), making the documented drop-in
    integration work without a custom path suffix.
    """
    return await proxy_chat_completions(request, payload, x_artsa_provider, x_artsa_forward_to)


@router.post("/proxy/v1/chat/completions")
async def proxy_chat_completions(
    request: Request,
    payload: dict[str, Any] = Body(...),
    x_artsa_provider: str | None = Header(None, alias="X-ARTSA-Provider"),
    x_artsa_forward_to: str | None = Header(None, alias="X-ARTSA-Forward-To"),
) -> Response:
    """OpenAI-compatible chat completions with detection-gated forwarding."""
    if not settings.ARTSA_PROXY_ENABLED:
        raise HTTPException(status_code=503, detail="ARTSA proxy gateway is disabled")

    proxy = get_llm_proxy()
    provider = x_artsa_provider or settings.ARTSA_PROXY_DEFAULT_PROVIDER or "openai"
    model = proxy.resolve_model(provider, str(payload.get("model", "unknown")))
    stream = bool(payload.get("stream", False))
    messages = payload.get("messages") or []
    content = proxy.combined_prompt(messages)

    block = await _handle_decision(request, content, provider, model, stream)
    if block is not None:
        return JSONResponse(status_code=403, content=_openai_block_error(block))

    if stream:
        # SANITIZE may have modified the payload; keep the body consistent.
        action, _ = proxy.decide(content)
        if action == ProxyAction.SANITIZE:
            payload["messages"] = proxy.sanitize_messages(messages)

        base_url, api_key, extra_headers = proxy.resolve_target(provider, x_artsa_forward_to)
        url = f"{base_url}/chat/completions"

        async def _stream_forward() -> AsyncIterator[str]:
            try:
                async for chunk in proxy.stream_chat(url, payload, api_key, extra_headers):
                    yield chunk.decode("utf-8", errors="replace")
            except Exception as exc:
                error_body = {"error": {"message": str(exc), "type": "upstream_error", "code": "proxy_upstream_error"}}
                yield _sse(error_body)
                yield "data: [DONE]\n\n"

        return StreamingResponse(_stream_forward(), media_type="text/event-stream")

    # Non-streaming: apply sanitization before forwarding.
    action, _ = proxy.decide(content)
    if action == ProxyAction.SANITIZE:
        payload["messages"] = proxy.sanitize_messages(messages)

    base_url, api_key, extra_headers = proxy.resolve_target(provider, x_artsa_forward_to)
    url = f"{base_url}/chat/completions"

    try:
        upstream = await proxy.forward_chat(url, payload, api_key, extra_headers)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"message": f"Upstream LLM unreachable: {exc}", "provider": provider},
        ) from exc

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        media_type="application/json",
    )


@router.post("/proxy/messages")
async def proxy_messages_short(
    request: Request,
    payload: dict[str, Any] = Body(...),
    x_artsa_provider: str | None = Header(None, alias="X-ARTSA-Provider"),
    x_artsa_forward_to: str | None = Header(None, alias="X-ARTSA-Forward-To"),
) -> Response:
    """Alias for ``/proxy/v1/messages`` (Anthropic client compatibility)."""
    return await proxy_messages(request, payload, x_artsa_provider, x_artsa_forward_to)


@router.post("/proxy/v1/messages")
async def proxy_messages(
    request: Request,
    payload: dict[str, Any] = Body(...),
    x_artsa_provider: str | None = Header(None, alias="X-ARTSA-Provider"),
    x_artsa_forward_to: str | None = Header(None, alias="X-ARTSA-Forward-To"),
) -> Response:
    """Anthropic-compatible /v1/messages with detection-gated forwarding.

    When the resolved provider is Anthropic the request is forwarded natively
    to ``{base}/messages``; otherwise it is translated to the OpenAI-compatible
    protocol and the response is translated back to the Anthropic shape.
    """
    if not settings.ARTSA_PROXY_ENABLED:
        raise HTTPException(status_code=503, detail="ARTSA proxy gateway is disabled")

    proxy = get_llm_proxy()
    provider = x_artsa_provider or settings.ARTSA_PROXY_DEFAULT_PROVIDER or "openai"
    model = proxy.resolve_model(provider, str(payload.get("model", "unknown")))
    stream = bool(payload.get("stream", False))
    openai_payload = proxy.anthropic_to_openai(payload)
    content = proxy.combined_prompt(openai_payload.get("messages") or [])

    block = await _handle_decision(request, content, provider, model, stream)
    if block is not None:
        return JSONResponse(status_code=403, content=_anthropic_block_error(block))

    action, _ = proxy.decide(content)
    if action == ProxyAction.SANITIZE:
        openai_payload["messages"] = proxy.sanitize_messages(openai_payload.get("messages") or [])

    base_url, api_key, extra_headers = proxy.resolve_target(provider, x_artsa_forward_to)

    if provider == "anthropic":
        url = f"{base_url}/messages"
        forward_payload: dict[str, Any] = payload
        if action == ProxyAction.SANITIZE:
            messages = payload.get("messages") or []
            for message in messages:
                if message.get("role") == "user":
                    text = message.get("content")
                    if isinstance(text, str):
                        message["content"] = f"{text}\n\n[ARTSA] System instructions remain in force."
                    break
            forward_payload = {**payload, "messages": messages}

        if stream:
            async def _anthropic_stream() -> AsyncIterator[str]:
                try:
                    async for chunk in proxy.stream_chat(url, forward_payload, api_key, extra_headers):
                        yield chunk.decode("utf-8", errors="replace")
                except Exception as exc:
                    yield _sse(
                        {"type": "error", "error": {"type": "api_error", "message": str(exc)}}
                    )

            return StreamingResponse(_anthropic_stream(), media_type="text/event-stream")

        try:
            upstream = await proxy.forward_chat(url, forward_payload, api_key, extra_headers)
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail={"message": f"Upstream Anthropic unreachable: {exc}"},
            ) from exc
        return Response(content=upstream.content, status_code=upstream.status_code, media_type="application/json")

    # Non-Anthropic upstream: OpenAI protocol.
    url = f"{base_url}/chat/completions"

    if stream:
        async def _converted_stream() -> AsyncIterator[str]:
            emitted_first = False
            try:
                async for chunk in proxy.stream_chat(url, openai_payload, api_key, extra_headers):
                    for line in chunk.decode("utf-8", errors="replace").splitlines():
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if not data or data == "[DONE]":
                            continue
                        try:
                            obj = json.loads(data)
                        except json.JSONDecodeError:
                            continue
                        delta = (obj.get("choices") or [{}])[0].get("delta", {})
                        text = delta.get("content")
                        if not emitted_first:
                            emitted_first = True
                            yield _sse(
                                {
                                    "type": "message_start",
                                    "message": {
                                        "id": f"msg_{uuid.uuid4().hex}",
                                        "type": "message",
                                        "role": "assistant",
                                        "model": model,
                                        "content": [],
                                        "stop_reason": None,
                                    },
                                }
                            )
                            yield _sse(
                                {
                                    "type": "content_block_start",
                                    "index": 0,
                                    "content_block": {"type": "text", "text": ""},
                                }
                            )
                        if text:
                            yield _sse(
                                {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": text}}
                            )
                if emitted_first:
                    yield _sse({"type": "content_block_stop", "index": 0})
                    yield _sse({"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": None}})
                    yield _sse({"type": "message_stop"})
                else:
                    yield _sse({"type": "error", "error": {"type": "api_error", "message": "No upstream stream data"}})
            except Exception as exc:
                yield _sse({"type": "error", "error": {"type": "api_error", "message": str(exc)}})

        return StreamingResponse(_converted_stream(), media_type="text/event-stream")

    try:
        upstream = await proxy.forward_chat(url, openai_payload, api_key, extra_headers)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={"message": f"Upstream LLM unreachable: {exc}", "provider": provider},
        ) from exc

    try:
        upstream_json = upstream.json()
    except Exception:
        return Response(content=upstream.content, status_code=upstream.status_code, media_type="application/json")

    return JSONResponse(content=proxy.openai_to_anthropic(payload, upstream_json))
