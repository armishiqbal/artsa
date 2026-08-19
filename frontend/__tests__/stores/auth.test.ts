import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  useAuthStore,
  getBearerToken,
  getRefreshToken,
  getTokenExpiresAt,
  tokenNeedsRefresh,
} from "@/lib/stores/auth";

const SESSION_STORAGE_KEY = "artsa-auth";

describe("auth store", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.persist.clearStorage();
    useAuthStore.getState().clearAuth();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("setSession populates access + refresh tokens and computes expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    useAuthStore.getState().setSession({
      access_token: "access-token-123",
      refresh_token: "refresh-token-456",
      expires_in: 3600,
    });

    const state = useAuthStore.getState();
    expect(state.bearerToken).toBe("access-token-123");
    expect(state.refreshToken).toBe("refresh-token-456");
    expect(state.expiresAt).toBe(new Date("2026-01-01T01:00:00Z").getTime());
    expect(getBearerToken()).toBe("access-token-123");
    expect(getRefreshToken()).toBe("refresh-token-456");
  });

  it("setSession without refresh_token or expires_in leaves them null", () => {
    useAuthStore.getState().setSession({ access_token: "bare-token" });

    const state = useAuthStore.getState();
    expect(state.bearerToken).toBe("bare-token");
    expect(state.refreshToken).toBeNull();
    expect(state.expiresAt).toBeNull();
  });

  it("setBearerToken clears the refresh token and expiry (null-handling regression)", () => {
    useAuthStore.getState().setSession({
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 300,
    });
    expect(getRefreshToken()).toBe("refresh");
    expect(getTokenExpiresAt()).not.toBeNull();

    // Replacing the bearer token must drop the stale refresh token + expiry.
    useAuthStore.getState().setBearerToken("new-access");

    const state = useAuthStore.getState();
    expect(state.bearerToken).toBe("new-access");
    expect(state.refreshToken).toBeNull();
    expect(state.expiresAt).toBeNull();
  });

  it("setBearerToken(null) resets all persisted auth fields", () => {
    useAuthStore.getState().setSession({
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 300,
    });

    useAuthStore.getState().setBearerToken(null);

    const state = useAuthStore.getState();
    expect(state.bearerToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.expiresAt).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toContain('"bearerToken":null');
  });

  it("setSession clears a stored API key so the bearer is used", () => {
    useAuthStore.getState().setApiKey("static-key");
    useAuthStore.getState().setSession({ access_token: "session-token" });

    const state = useAuthStore.getState();
    expect(state.apiKey).toBeNull();
    expect(state.bearerToken).toBe("session-token");
  });

  it("clearAuth resets every field to null", () => {
    useAuthStore.getState().setSession({
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 300,
    });

    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.bearerToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.expiresAt).toBeNull();
  });

  it("tokenNeedsRefresh flags tokens expiring inside the buffer window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    // Expiry 10s from now — well inside the default 5-minute buffer.
    useAuthStore.getState().setSession({
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 10,
    });
    expect(tokenNeedsRefresh()).toBe(true);

    // Expiry 1 hour from now — outside the buffer.
    useAuthStore.getState().setSession({
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 3600,
    });
    expect(tokenNeedsRefresh()).toBe(false);

    // No expiry set — never considered due.
    useAuthStore.getState().clearAuth();
    expect(tokenNeedsRefresh()).toBe(false);
  });
});
