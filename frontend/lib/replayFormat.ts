/**
 * Pure formatting helpers for session replay payloads.
 */

export function formatPayload(args: Record<string, unknown>): string {
  if (typeof args.payload === "string") return args.payload;
  return JSON.stringify(args, null, 2);
}

export function formatResponse(response: Record<string, unknown> | null | undefined): string {
  if (!response) return "No defender response captured.";
  if (typeof response.text === "string") return response.text;
  return JSON.stringify(response, null, 2);
}
