import { describe, it, expect } from "vitest";
import {
  AVATAR_OPTIONS,
  ROLE_LABEL,
  METHOD_LABEL,
  roleLabel,
  methodLabel,
  formatMemberSince,
  passwordStrength,
  avatarIsEmoji,
  resolveAvatarSrc,
} from "@/lib/profile";

describe("roleLabel", () => {
  it("maps known roles to friendly labels", () => {
    expect(roleLabel("admin")).toBe("Administrator");
    expect(roleLabel("analyst")).toBe("Analyst");
    expect(roleLabel("redteam")).toBe("Red Team");
    expect(roleLabel("readonly")).toBe("Read-only");
  });

  it("title-cases unknown roles instead of returning the raw key", () => {
    expect(roleLabel("operator")).toBe("Operator");
    expect(roleLabel("")).toBe("User");
  });

  it("keeps every ROLE_LABEL key resolving", () => {
    for (const key of Object.keys(ROLE_LABEL)) {
      expect(roleLabel(key)).toBe(ROLE_LABEL[key]);
    }
  });
});

describe("methodLabel", () => {
  it("maps known auth methods", () => {
    expect(methodLabel("password")).toBe("Password");
    expect(methodLabel("api_key")).toBe("API key");
    expect(methodLabel("oidc")).toBe("SSO");
  });

  it("returns a neutral fallback for missing input", () => {
    expect(methodLabel(null)).toBe("external method");
    expect(methodLabel(undefined)).toBe("external method");
    expect(methodLabel("")).toBe("external method");
  });

  it("keeps every METHOD_LABEL key resolving", () => {
    for (const key of Object.keys(METHOD_LABEL)) {
      expect(methodLabel(key)).toBe(METHOD_LABEL[key]);
    }
  });
});

describe("formatMemberSince", () => {
  it("formats a valid ISO timestamp", () => {
    const out = formatMemberSince("2025-01-02T10:30:00Z");
    expect(out).not.toBeNull();
    expect(out).toContain("2025");
    expect(out).not.toContain("Invalid");
  });

  it("returns null for missing or malformed input (no 'Invalid Date')", () => {
    expect(formatMemberSince(null)).toBeNull();
    expect(formatMemberSince("")).toBeNull();
    expect(formatMemberSince("not-a-date")).toBeNull();
  });
});

describe("passwordStrength", () => {
  it("returns null for empty input so the meter can hide", () => {
    expect(passwordStrength("")).toBeNull();
    expect(passwordStrength("   ")).not.toBeNull();
  });

  it("is weak for short passwords", () => {
    expect(passwordStrength("abc123")?.bars).toBe(1);
    expect(passwordStrength("abc123")?.label).toBe("Weak");
  });

  it("rewards length and character classes", () => {
    const strong = passwordStrength("Str0ng!Passphrase");
    expect(strong?.bars).toBeGreaterThanOrEqual(3);
    expect(strong?.label).toBe("Strong");
  });

  it("clamps the score to 1–4 bars", () => {
    const s = passwordStrength("A very very long complex password with 12345 and special !@# chars");
    expect(s?.bars).toBe(4);
    expect(s?.bar).toBe("bg-foreground/70");
  });

  it("returns a bar token usable as a Tailwind class for every score", () => {
    for (const pw of ["x", "xyZ!", "xyZ!123", "x".repeat(12)]) {
      const s = passwordStrength(pw);
      expect(s?.bar).toMatch(/^bg-(foreground\/70|foreground\/45|muted-foreground\/60)$/);
    }
  });
});

describe("avatar options", () => {
  it("exposes a non-empty, de-duplicated emoji set", () => {
    expect(AVATAR_OPTIONS.length).toBeGreaterThan(0);
    expect(new Set(AVATAR_OPTIONS).size).toBe(AVATAR_OPTIONS.length);
  });
});

describe("avatarIsEmoji", () => {
  it("accepts emoji presets from AVATAR_OPTIONS", () => {
    expect(avatarIsEmoji("🦊")).toBe(true);
    expect(avatarIsEmoji(AVATAR_OPTIONS[0])).toBe(true);
  });

  it("rejects image paths, null, and empty strings", () => {
    expect(avatarIsEmoji("/api/v1/auth/me/avatar/user-abc.png")).toBe(false);
    expect(avatarIsEmoji("https://example.com/a.png")).toBe(false);
    expect(avatarIsEmoji(null)).toBe(false);
    expect(avatarIsEmoji(undefined)).toBe(false);
    expect(avatarIsEmoji("")).toBe(false);
  });
});

describe("resolveAvatarSrc", () => {
  it("routes backend-relative image paths through the BFF proxy", () => {
    expect(resolveAvatarSrc("/api/v1/auth/me/avatar/user-abc.png")).toBe(
      "/api/backend/api/v1/auth/me/avatar/user-abc.png"
    );
  });

  it("passes absolute URLs through unchanged", () => {
    expect(resolveAvatarSrc("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
  });

  it("returns null for emoji, null, undefined, and empty strings", () => {
    expect(resolveAvatarSrc("🦊")).toBeNull();
    expect(resolveAvatarSrc(null)).toBeNull();
    expect(resolveAvatarSrc(undefined)).toBeNull();
    expect(resolveAvatarSrc("")).toBeNull();
  });
});
