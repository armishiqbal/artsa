/** Map ingest API responses to telemetry rows (matches WebSocket `telemetry_bus` shape). */

export interface IngestRequestPayload {
  session_id: string;
  agent_id: string;
  tool_name: string;
  arguments?: Record<string, unknown>;
}

export interface IngestApiPayload {
  session_id?: string;
  agent_id?: string;
  tool_name?: string;
  risk_score?: { overall_score?: number };
  verdict?: { verdict?: string; recommended_action?: string; confidence?: number };
}

export function ingestResponseToTelemetry(
  request: IngestRequestPayload,
  response: IngestApiPayload
): Record<string, unknown> {
  const risk = response.risk_score?.overall_score ?? 0;
  const verdict = response.verdict?.verdict ?? "";
  const action = response.verdict?.recommended_action ?? "";
  return {
    type: "tool_call",
    event_id: `ingest-${request.session_id}-${Date.now()}`,
    session_id: response.session_id ?? request.session_id,
    agent_id: response.agent_id ?? request.agent_id,
    tool_name: response.tool_name ?? request.tool_name,
    risk_score: risk,
    verdict,
    action,
    recommended_action: action,
    triggered_at: new Date().toISOString(),
    source: "ingest",
  };
}

export function mergeTelemetryEvents(
  existing: Array<Record<string, unknown>>,
  incoming: Array<Record<string, unknown>>,
  limit = 50
): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const merged: Array<Record<string, unknown>> = [];

  const eventKey = (evt: Record<string, unknown>) =>
    String(evt.event_id ?? "") ||
    `${String(evt.session_id ?? "")}:${String(evt.tool_name ?? "")}:${String(evt.triggered_at ?? evt.timestamp ?? "")}:${String(evt.risk_score ?? "")}:${String(evt.verdict ?? "")}`;

  // Prefer newest first for live Logs / Command Center.
  for (const evt of [...incoming, ...existing]) {
    const key = eventKey(evt);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(evt);
  }

  merged.sort((a, b) => {
    const ta = Date.parse(String(a.triggered_at ?? a.timestamp ?? "")) || 0;
    const tb = Date.parse(String(b.triggered_at ?? b.timestamp ?? "")) || 0;
    return tb - ta;
  });

  return merged.slice(0, limit);
}
