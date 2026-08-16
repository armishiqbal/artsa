import type { CustomIntegration, EventType } from "@/lib/types";

const SECRET_TOKEN_RE = /\{\{\s*secret:([^{}]+)\s*\}\}/g;

/**
 * Validate a payload template as strict JSON.
 * Returns an error message, or null when the template is valid (or empty).
 */
export function validatePayloadTemplate(json: string): string | null {
  if (!json.trim()) return null;
  try {
    JSON.parse(json);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Invalid JSON";
  }
}

/**
 * Collect every `{{secret:name}}` reference from headers + payload template.
 * Returns unique, sorted secret names so the form can prompt for their values.
 */
export function extractSecretRefs(
  headers: Record<string, string>,
  template: string | null
): string[] {
  const refs = new Set<string>();
  const scan = (text: string) => {
    // RegExp.exec loop (not matchAll) keeps this targeting es5.
    let match: RegExpExecArray | null;
    SECRET_TOKEN_RE.lastIndex = 0;
    while ((match = SECRET_TOKEN_RE.exec(text)) !== null) {
      const name = match[1].trim();
      if (name) refs.add(name);
    }
  };
  Object.values(headers ?? {}).forEach(scan);
  if (template) scan(template);
  return Array.from(refs).sort();
}

/**
 * Build a starter payload template for a given event type, using the fields
 * the schema advertises (see GET /integrations/schema -> template_fields).
 */
export function buildSampleTemplate(eventType: EventType): string {
  const fields: Record<EventType, Record<string, string>> = {
    alert: {
      source: "ARTSA",
      alert_id: "{{id}}",
      agent_id: "{{agent_id}}",
      severity: "{{severity}}",
      title: "{{title}}",
      message: "{{message}}",
      risk_score: "{{risk_score}}",
      triggered_at: "{{triggered_at}}",
    },
    tool_call: {
      source: "ARTSA",
      event_type: "{{type}}",
      session_id: "{{session_id}}",
      agent_id: "{{agent_id}}",
      tool_name: "{{tool_name}}",
      verdict: "{{verdict}}",
      action: "{{action}}",
      risk_score: "{{risk_score}}",
      timestamp: "{{timestamp}}",
    },
    proxy_call: {
      source: "ARTSA",
      event_type: "{{type}}",
      session_id: "{{session_id}}",
      agent_id: "{{agent_id}}",
      provider: "{{provider}}",
      model: "{{model}}",
      action: "{{action}}",
      verdict: "{{verdict}}",
      risk_score: "{{risk_score}}",
      latency_ms: "{{latency_ms}}",
    },
    session_action: {
      source: "ARTSA",
      event_type: "{{type}}",
      session_id: "{{session_id}}",
      agent_id: "{{agent_id}}",
      action: "{{action}}",
      session_status: "{{session_status}}",
      verdict: "{{verdict}}",
      risk_score: "{{risk_score}}",
      timestamp: "{{timestamp}}",
    },
  };
  return JSON.stringify(fields[eventType], null, 2);
}

/** True when the connector has no custom payload template (full default). */
export function usesDefaultPayload(integration: Pick<CustomIntegration, "payload_template">): boolean {
  return !integration.payload_template?.trim();
}
