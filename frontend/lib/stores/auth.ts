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
  /** Drop an expired JWT but keep the local profile so the BFF can fall back to ARTSA_API_KEY. */
  clearBearerKeepUser: () => void;
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
          apiKey: null,
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
      clearBearerKeepUser: () =>
        set((state) => ({
          bearerToken: null,
          refreshToken: null,
          expiresAt: null,
          user: state.user,
        })),
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
// AuthGuard on mount. Callers that need auth state before continuing (such as
// the login redirect) can await the same hydration operation.
let hydrationPromise: Promise<void> | null = null;

/** Rehydrate persisted auth state on the client after mount. Idempotent — safe
 * to call from multiple components; only the first invocation rehydrates. */
export function hydrateAuthStore(): Promise<void> {
  if (typeof window === "undefined" || useAuthStore.persist.hasHydrated()) {
    return Promise.resolve();
  }
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(finish, 200);
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      clearTimeout(timer);
      unsubscribe();
      finish();
    });
    void useAuthStore.persist.rehydrate();
  });
  return hydrationPromise;
}

/** True when access token expires within the given buffer (default 5 min). */
export function tokenNeedsRefresh(bufferMs = 5 * 60 * 1000): boolean {
  const expiresAt = getTokenExpiresAt();
  if (!expiresAt) return false;
  return Date.now() >= expiresAt - bufferMs;
}
