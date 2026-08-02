import { getBearerToken } from "@/lib/stores/auth";

const API_KEY = process.env.NEXT_PUBLIC_ARTSA_API_KEY || "";

/** Build authenticated WebSocket URL (credentials via query params). */
export function buildWebSocketUrl(path = "/api/v1/websocket"): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  let base: string;

  if (configured) {
    base = configured;
  } else {
    const httpBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    base = httpBase.replace(/^http/, "ws") + path;
  }

  const url = new URL(base);
  const bearer = getBearerToken();
  if (bearer) {
    url.searchParams.set("access_token", bearer);
  } else if (API_KEY) {
    url.searchParams.set("api_key", API_KEY);
  }

  return url.toString();
}
