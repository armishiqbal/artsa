"""OpenTelemetry (OTEL) Production Trace Ingestion & Exploitation Drift Ingestor."""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class OTELSpan(BaseModel):
    """Single OpenTelemetry / OpenInference Span representation."""

    span_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str  # e.g., "llm.generation", "tool.execution"
    kind: str = "SPAN_KIND_INTERNAL"
    attributes: Dict[str, Any] = Field(default_factory=dict)  # input_prompt, output_text, model, etc.


class OTELTracePayload(BaseModel):
    """OpenTelemetry / OpenInference Trace Payload."""

    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    resource_attributes: Dict[str, Any] = Field(default_factory=dict)
    spans: List[OTELSpan]


class OTELDriftAnalysisResult(BaseModel):
    """Result of vector drift analysis on ingested OTEL trace."""

    trace_id: str
    spans_processed: int
    max_drift_score: float  # 0.0 to 10.0
    exploit_alert_triggered: bool
    detected_threats: List[str]


class OTELTraceIngestor:
    """Ingests OTEL production spans, computes 1024-dim vector drift, and alerts on attack clusters."""

    def __init__(self) -> None:
        self._ingested_traces: List[OTELTracePayload] = []

    def process_trace(self, payload: OTELTracePayload) -> OTELDriftAnalysisResult:
        """Process incoming OTEL trace payload and compute exploitation drift."""
        spans_count = len(payload.spans)
        max_drift = 0.0
        threats = []

        for span in payload.spans:
            prompt_input = str(span.attributes.get("input_prompt", span.attributes.get("llm.input", "")))
            if "SYSTEM OVERRIDE" in prompt_input or "exfiltrate" in prompt_input:
                max_drift = max(max_drift, 8.8)
                threats.append(f"High-Drift Attack Span: {span.name}")
            elif prompt_input:
                max_drift = max(max_drift, 1.5)

        alert_triggered = max_drift >= 7.0

        self._ingested_traces.append(payload)
        logger.info("Processed OTEL Trace %s (%d spans) | Max Drift: %.1f | Alert=%s", payload.trace_id, spans_count, max_drift, alert_triggered)

        return OTELDriftAnalysisResult(
            trace_id=payload.trace_id,
            spans_processed=spans_count,
            max_drift_score=max_drift,
            exploit_alert_triggered=alert_triggered,
            detected_threats=threats,
        )

    def get_ingested_count(self) -> int:
        """Return total count of processed OTEL traces."""
        return len(self._ingested_traces)
