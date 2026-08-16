import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

/** Local account profile (from login/register response or /config/me). */
export interface AuthUser {
  email?: string | null;
  role?: string | null;
  display_name?: string | null;
  avatar?: string | null;
  phone?: string | null;
  location?: string | null;
  organization?: string | null;
}

interface AuthStore {
  bearerToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  apiKey: string | null;
  user: AuthUser | null;
  setBearerToken: (token: string | null) => void;
  setSession: (session: AuthSession, user?: AuthUser | null) => void;
  setApiKey: (key: string | null) => void;
  clearAuth: () => void;
}

/** SSR-safe sessionStorage adapter — no-op during Next.js prerender. */
const safeSessionStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(name);
  },
  setItem: (name, value) => {
    if (typeof window !== "undefined") sessionStorage.setItem(name, value);
  },
  removeItem: (name) => {
    if (typeof window !== "undefined") sessionStorage.removeItem(name);
  },
};

function computeExpiresAt(expiresInSec?: number): number | null {
  if (!expiresInSec || expiresInSec <= 0) return null;
  return Date.now() + expiresInSec * 1000;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      bearerToken: null,
      refreshToken: null,
      expiresAt: null,
      apiKey: null,
      user: null,
      setBearerToken: (token) =>
        set({
          bearerToken: token,
          refreshToken: null,
          expiresAt: null,
          user: null,
        }),
      setSession: (session, user) =>
        set({
          bearerToken: session.access_token,
          refreshToken: session.refresh_token ?? null,
          expiresAt: computeExpiresAt(session.expires_in),
          user: user ?? null,
        }),
      setApiKey: (key) =>
        set({
          apiKey: key,
          bearerToken: null,
          refreshToken: null,
          expiresAt: null,
          user: null,
        }),
      clearAuth: () =>
        set({
          bearerToken: null,
          refreshToken: null,
          expiresAt: null,
          apiKey: null,
          user: null,
        }),
    }),
    {
      name: "artsa-auth",
      storage: createJSONStorage(() => safeSessionStorage),
      skipHydration: true,
      partialize: (state) => ({
        bearerToken: state.bearerToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        apiKey: state.apiKey,
        user: state.user,
      }),
    }
  )
);

/** Read bearer token outside React (e.g. api.ts). */
export function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  return useAuthStore.getState().bearerToken;
}

/** Read the role API key outside React (e.g. api.ts). */
export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return useAuthStore.getState().apiKey;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return useAuthStore.getState().refreshToken;
}

export function getTokenExpiresAt(): number | null {
  if (typeof window === "undefined") return null;
  return useAuthStore.getState().expiresAt;
}

// Single-flight guard: hydrateAuthStore() runs from both AuthHydrator and
// AuthGuard on mount. The module flag covers a second caller arriving while
// rehydration is still in flight; hasHydrated() covers re-mounts after the
// store already finished rehydrating (e.g. HMR).
let hydrationStarted = false;

/** Rehydrate persisted auth state on the client after mount. Idempotent — safe
 * to call from multiple components; only the first invocation rehydrates, so
 * the first /config/me request never races a second rehydrate. */
export function hydrateAuthStore(): void {
  if (typeof window === "undefined" || hydrationStarted || useAuthStore.persist.hasHydrated()) {
    return;
  }
  hydrationStarted = true;
  void useAuthStore.persist.rehydrate();
}

/** True when access token expires within the given buffer (default 5 min). */
export function tokenNeedsRefresh(bufferMs = 5 * 60 * 1000): boolean {
  const expiresAt = getTokenExpiresAt();
  if (!expiresAt) return false;
  return Date.now() >= expiresAt - bufferMs;
}
