/**
 * HTTP client for the unified ARTSA API (containment + wargame + library on port 8000).
 */

import { toast } from "@/lib/stores/toast";
import { getBearerToken } from "@/lib/stores/auth";

const API_BASE_URL = "/api/backend";

function buildHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const bearer = getBearerToken();
  if (bearer) {
    headers["Authorization"] = `Bearer ${bearer}`;
  }
  return { ...headers, ...(extra as Record<string, string> | undefined) };
}

export interface FetchOptions extends RequestInit {
  /** Suppress error toasts (for background polling) */
  silent?: boolean;
}

export async function fetchFromBackend<T = unknown>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T | null> {
  const { silent = false, ...requestInit } = options;
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...requestInit,
      headers: buildHeaders(requestInit.headers),
    });

    if (!res.ok) {
      if (!silent) {
        toast("Request failed", {
          description: `${endpoint} returned ${res.status}`,
          variant: "error",
        });
      }
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    if (!silent) {
      toast("Backend unreachable", {
        description: "Ensure the API is running on port 8000.",
        variant: "error",
      });
    }
    console.warn(`[ARTSA API] Unable to reach ${url}:`, (err as Error).message);
    return null;
  }
}
