import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

interface AuthStore {
  bearerToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  setBearerToken: (token: string | null) => void;
  setSession: (session: AuthSession) => void;
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
      setBearerToken: (token) =>
        set({
          bearerToken: token,
          refreshToken: token ? undefined : null,
          expiresAt: token ? null : null,
        }),
      setSession: (session) =>
        set({
          bearerToken: session.access_token,
          refreshToken: session.refresh_token ?? null,
          expiresAt: computeExpiresAt(session.expires_in),
        }),
      clearAuth: () =>
        set({
          bearerToken: null,
          refreshToken: null,
          expiresAt: null,
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
      }),
    }
  )
);

/** Read bearer token outside React (e.g. api.ts). */
export function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  return useAuthStore.getState().bearerToken;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return useAuthStore.getState().refreshToken;
}

export function getTokenExpiresAt(): number | null {
  if (typeof window === "undefined") return null;
  return useAuthStore.getState().expiresAt;
}

/** Rehydrate persisted auth state on the client after mount. */
export function hydrateAuthStore(): void {
  if (typeof window !== "undefined") {
    useAuthStore.persist.rehydrate();
  }
}

/** True when access token expires within the given buffer (default 5 min). */
export function tokenNeedsRefresh(bufferMs = 5 * 60 * 1000): boolean {
  const expiresAt = getTokenExpiresAt();
  if (!expiresAt) return false;
  return Date.now() >= expiresAt - bufferMs;
}
