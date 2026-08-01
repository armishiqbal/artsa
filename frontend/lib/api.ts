/**
 * Utility helper to handle end-to-end connection between Next.js Frontend and API Gateway Backend.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchFromBackend(endpoint: string, options: RequestInit = {}) {
  // Connect directly to API Gateway to avoid Next.js dev proxy ECONNRESET logs
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      console.warn(`[ARTSA API] Request to ${endpoint} returned status ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    // Graceful offline fallback when API Gateway is offline or starting up
    console.warn(`[ARTSA API Gateway Offline] Unable to reach ${url}:`, (err as Error).message);
    return null;
  }
}
