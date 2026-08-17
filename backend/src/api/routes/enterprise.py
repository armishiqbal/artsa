"""Enterprise integration routes — MCP proxy inspection and OTEL trace ingest."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from src.core.config import settings
from src.services.mcp_proxy import MCPJsonRpcRequest, MCPProxyInterceptor
from src.services.otel_ingest import OTELTraceIngestor, OTELTracePayload

router = APIRouter(tags=["Enterprise"])

_mcp = MCPProxyInterceptor()
_otel = OTELTraceIngestor()


@router.post("/mcp/proxy")
def mcp_proxy_inspect(req: MCPJsonRpcRequest) -> dict[str, Any]:
    """Inspect MCP JSON-RPC requests for tool poisoning / injection before forwarding."""
    return _mcp.inspect_request(req).model_dump()


@router.get("/mcp/inspections")
def get_mcp_inspections() -> dict[str, Any]:
    """Return recent MCP inspection history."""
    return {"inspections": [r.model_dump() for r in _mcp.get_history()]}


@router.post("/otel/v1/traces")
def otel_trace_ingest(payload: OTELTracePayload) -> dict[str, Any]:
    """Ingest OpenTelemetry / OpenInference spans and flag exploitation drift.

    EXPERIMENTAL: gated behind ``ARTSA_OTEL_ENABLED`` (default off). Returns 404
    when disabled — this is not a supported capability.
    """
    if not settings.ARTSA_OTEL_ENABLED:
        raise HTTPException(
            status_code=404,
            detail=(
                "OTEL trace ingest is experimental and disabled by default; "
                "set ARTSA_OTEL_ENABLED=true to enable"
            ),
        )
    return _otel.process_trace(payload).model_dump()
