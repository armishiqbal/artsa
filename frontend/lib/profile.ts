/** Pure profile helpers + label maps, shared by the profile page and tests. */
import { formatDate } from "@/lib/dates";

export type RoleBadgeVariant = "default" | "secondary" | "info" | "warning" | "success";

export const AVATAR_OPTIONS = ["🦊", "🐼", "🦁", "🐸", "🐙", "🦄", "🐯", "🐨", "🦉", "🐳", "🤖", "🛡️"];

export interface AvatarColorStyle {
  id: string;
  name: string;
  bg: string;
  color: string;
  border: string;
  dot: string;
  glow: string;
}

export interface VectorAvatarPreset {
  id: string;
  name: string;
  iconName: string;
}

export const ENTERPRISE_AVATAR_COLORS: AvatarColorStyle[] = [
  {
    id: "color:amber",
    name: "Cyber Ember",
    bg: "rgba(249, 115, 22, 0.15)",
    color: "#f97316",
    border: "rgba(249, 115, 22, 0.5)",
    dot: "#f97316",
    glow: "0 0 16px rgba(249, 115, 22, 0.25)",
  },
  {
    id: "color:emerald",
    name: "Emerald Verified",
    bg: "rgba(16, 185, 129, 0.15)",
    color: "#10b981",
    border: "rgba(16, 185, 129, 0.5)",
    dot: "#10b981",
    glow: "0 0 16px rgba(16, 185, 129, 0.25)",
  },
  {
    id: "color:cobalt",
    name: "Cobalt Security",
    bg: "rgba(59, 130, 246, 0.15)",
    color: "#3b82f6",
    border: "rgba(59, 130, 246, 0.5)",
    dot: "#3b82f6",
    glow: "0 0 16px rgba(59, 130, 246, 0.25)",
  },
  {
    id: "color:amethyst",
    name: "Amethyst Neural",
    bg: "rgba(168, 85, 247, 0.15)",
    color: "#a855f7",
    border: "rgba(168, 85, 247, 0.5)",
    dot: "#a855f7",
    glow: "0 0 16px rgba(168, 85, 247, 0.25)",
  },
  {
    id: "color:crimson",
    name: "Red Team Tactical",
    bg: "rgba(244, 63, 94, 0.15)",
    color: "#f43f5e",
    border: "rgba(244, 63, 94, 0.5)",
    dot: "#f43f5e",
    glow: "0 0 16px rgba(244, 63, 94, 0.25)",
  },
  {
    id: "color:titanium",
    name: "Titanium Slate",
    bg: "rgba(148, 163, 184, 0.15)",
    color: "#94a3b8",
    border: "rgba(148, 163, 184, 0.5)",
    dot: "#94a3b8",
    glow: "0 0 16px rgba(148, 163, 184, 0.25)",
  },
];

export const ENTERPRISE_AVATAR_VECTORS: VectorAvatarPreset[] = [
  { id: "vector:shield", name: "Sentinel Shield", iconName: "Shield" },
  { id: "vector:cpu", name: "Neural Core", iconName: "Cpu" },
  { id: "vector:radar", name: "Telemetry Sensor", iconName: "Radio" },
  { id: "vector:lock", name: "Cryptographic Key", iconName: "KeyRound" },
  { id: "vector:terminal", name: "Terminal Console", iconName: "Terminal" },
  { id: "vector:sparkles", name: "Autonomous Agent", iconName: "Sparkles" },
];

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

/** True when the avatar is a vector preset */
export function avatarIsVector(avatar: string | null | undefined): boolean {
  if (!avatar) return false;
  return avatar.startsWith("vector:") || avatar.includes("vector:");
}

/** True when the avatar is purely a color monogram preset */
export function avatarIsColor(avatar: string | null | undefined): boolean {
  if (!avatar) return false;
  return avatar.startsWith("color:") && !avatar.includes("#") && !avatar.includes("vector:");
}

/** Parses composite avatar value (e.g. image path + color theme or vector + color theme). */
export function parseAvatarValue(avatar: string | null | undefined): {
  type: "image" | "vector" | "monogram";
  imageSrc: string | null;
  vectorId: string | null;
  colorId: string;
} {
  if (!avatar) {
    return { type: "monogram", imageSrc: null, vectorId: null, colorId: "color:amber" };
  }

  let raw = avatar;
  let colorId = "color:amber";

  if (raw.includes("#color:")) {
    const parts = raw.split("#");
    raw = parts[0];
    colorId = parts[1];
  } else if (raw.includes("?color=")) {
    const parts = raw.split("?color=");
    raw = parts[0];
    colorId = `color:${parts[1]}`;
  }

  if (raw.startsWith("color:")) {
    return { type: "monogram", imageSrc: null, vectorId: null, colorId: raw };
  }

  if (raw.startsWith("vector:")) {
    return { type: "vector", imageSrc: null, vectorId: raw, colorId };
  }

  if (avatarIsEmoji(raw)) {
    return { type: "monogram", imageSrc: null, vectorId: null, colorId: "color:amber" };
  }

  // It is an image URL or image path
  return { type: "image", imageSrc: raw, vectorId: null, colorId };
}

/** Resolve a stored avatar value to something an <img> can load. */
export function resolveAvatarSrc(avatar: string | null | undefined): string | null {
  if (!avatar || avatarIsEmoji(avatar)) return null;
  const parsed = parseAvatarValue(avatar);
  if (parsed.type !== "image" || !parsed.imageSrc) return null;
  const src = parsed.imageSrc;
  return src.startsWith("/api/v1/") ? `/api/backend${src}` : src;
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
