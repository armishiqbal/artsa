/** Pure profile helpers + label maps, shared by the profile page and tests. */
import { formatDate } from "@/lib/dates";

export type RoleBadgeVariant = "default" | "secondary" | "info" | "warning" | "success";

export const AVATAR_OPTIONS = ["🦊", "🐼", "🦁", "🐸", "🐙", "🦄", "🐯", "🐨", "🦉", "🐳", "🤖", "🛡️"];

export const ROLE_VARIANT: Record<string, RoleBadgeVariant> = {
  admin: "success",
  analyst: "info",
  redteam: "warning",
  readonly: "secondary",
};

export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  analyst: "Analyst",
  redteam: "Red Team",
  readonly: "Read-only",
};

export const METHOD_LABEL: Record<string, string> = {
  password: "Password",
  api_key: "API key",
  oidc: "SSO",
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? (role ? role[0].toUpperCase() + role.slice(1) : "User");
}

export function methodLabel(method: string | null | undefined): string {
  if (!method) return "external method";
  return METHOD_LABEL[method] ?? method;
}

/** True when the stored avatar is an emoji preset (vs. an uploaded image path). */
export function avatarIsEmoji(avatar: string | null | undefined): boolean {
  return avatar != null && avatar !== "" && AVATAR_OPTIONS.includes(avatar);
}

/** Resolve a stored avatar value to something an <img> can load.
 * Backend-relative image paths (/api/v1/…) go through the BFF proxy; absolute
 * URLs and emoji pass through unchanged (emoji callers use avatarIsEmoji). */
export function resolveAvatarSrc(avatar: string | null | undefined): string | null {
  if (!avatar || avatarIsEmoji(avatar)) return null;
  return avatar.startsWith("/api/v1/") ? `/api/backend${avatar}` : avatar;
}

/** "Member since" formatting — degrades to null instead of an invalid date. */
export function formatMemberSince(iso: string | null): string | null {
  if (!iso) return null;
  const formatted = formatDate(iso, { year: "numeric", month: "long", day: "numeric" });
  return formatted === "—" ? null : formatted;
}

/**
 * Strength of a candidate password: 1–4 bars, normalized from length + character
 * classes. Returns null for empty input so the meter can be hidden.
 */
export function passwordStrength(pw: string): { bars: number; label: string; bar: string } | null {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  score = Math.min(4, Math.max(1, score));
  const label = ["Weak", "Fair", "Good", "Strong"][score - 1];
  const bar = score >= 3 ? "bg-status-success" : score === 2 ? "bg-status-warning" : "bg-severity-critical";
  return { bars: score, label, bar };
}
