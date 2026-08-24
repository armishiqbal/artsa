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
    id: "color:titanium",
    name: "Slate",
    bg: "rgba(148, 163, 184, 0.12)",
    color: "#64748b",
    border: "rgba(148, 163, 184, 0.35)",
    dot: "#64748b",
    glow: "none",
  },
  {
    id: "color:emerald",
    name: "Green",
    bg: "rgba(16, 185, 129, 0.12)",
    color: "#059669",
    border: "rgba(16, 185, 129, 0.35)",
    dot: "#059669",
    glow: "none",
  },
  {
    id: "color:cobalt",
    name: "Blue",
    bg: "rgba(59, 130, 246, 0.12)",
    color: "#2563eb",
    border: "rgba(59, 130, 246, 0.35)",
    dot: "#2563eb",
    glow: "none",
  },
  {
    id: "color:amber",
    name: "Amber",
    bg: "rgba(249, 115, 22, 0.12)",
    color: "#ea580c",
    border: "rgba(249, 115, 22, 0.35)",
    dot: "#ea580c",
    glow: "none",
  },
  {
    id: "color:amethyst",
    name: "Purple",
    bg: "rgba(168, 85, 247, 0.12)",
    color: "#9333ea",
    border: "rgba(168, 85, 247, 0.35)",
    dot: "#9333ea",
    glow: "none",
  },
  {
    id: "color:crimson",
    name: "Red",
    bg: "rgba(244, 63, 94, 0.12)",
    color: "#e11d48",
    border: "rgba(244, 63, 94, 0.35)",
    dot: "#e11d48",
    glow: "none",
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
  admin: "secondary",
  analyst: "secondary",
  redteam: "secondary",
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
  const bar = score >= 3 ? "bg-foreground/70" : score === 2 ? "bg-foreground/45" : "bg-muted-foreground/60";
  return { bars: score, label, bar };
}
