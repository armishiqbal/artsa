"use client";

import {
  Shield,
  Cpu,
  Radio,
  KeyRound,
  Terminal,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  avatarIsEmoji,
  resolveAvatarSrc,
  parseAvatarValue,
  ENTERPRISE_AVATAR_COLORS,
} from "@/lib/profile";

export interface AvatarVisualProps {
  avatar: string | null | undefined;
  label: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showStatusIndicator?: boolean;
  statusOnline?: boolean;
}

const SIZE_MAP = {
  sm: "h-8 w-8 rounded-lg text-xs font-semibold",
  md: "h-11 w-11 rounded-xl text-sm font-semibold",
  lg: "h-16 w-16 rounded-xl text-xl font-bold",
  xl: "h-20 w-20 rounded-2xl text-2xl font-bold",
};

const ICON_SIZE_MAP = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
  xl: "h-9 w-9",
};

// Optical scale compensation for the Terminal icon due to its glyph whitespace
const TERMINAL_ICON_SIZE_MAP = {
  sm: "h-[18px] w-[18px] stroke-[2.25]",
  md: "h-[22px] w-[22px] stroke-[2.25]",
  lg: "h-[34px] w-[34px] stroke-[2.25]",
  xl: "h-[38px] w-[38px] stroke-[2.25]",
};

const EMOJI_SIZE_MAP = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-3xl",
};

export function AvatarVisual({
  avatar,
  label,
  size = "lg",
  className,
  showStatusIndicator = false,
  statusOnline = true,
}: AvatarVisualProps) {
  const src = resolveAvatarSrc(avatar);
  const parsed = parseAvatarValue(avatar);
  const isEmoji = avatarIsEmoji(avatar);
  const initials = (label || "AR").slice(0, 2).toUpperCase();
  const boxClasses = SIZE_MAP[size];
  const iconSize = ICON_SIZE_MAP[size];

  // Resolve active color preset
  const colorPreset =
    ENTERPRISE_AVATAR_COLORS.find((c) => c.id === parsed.colorId) ||
    ENTERPRISE_AVATAR_COLORS[0];

  return (
    <div className="relative inline-flex shrink-0">
      {src ? (
        /* Image Avatar with Color Theme Tint & Border Glow */
        <span
          style={{
            borderColor: colorPreset.color,
            boxShadow: colorPreset.glow,
          }}
          className={cn(
            "relative shrink-0 overflow-hidden border-2 bg-muted/30 shadow-sm transition-all duration-300",
            boxClasses,
            className
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={label || "User Avatar"}
            className="h-full w-full object-cover transition-all duration-300"
          />
          {/* Visual Duotone Color Tint Overlay on the Photo */}
          <span
            style={{
              backgroundColor: colorPreset.color,
              mixBlendMode: "color",
              opacity: 0.35,
            }}
            className="pointer-events-none absolute inset-0 rounded-[inherit] transition-all duration-300"
            aria-hidden="true"
          />
          {/* Subtle Ambient Color Ring */}
          <span
            style={{
              borderColor: colorPreset.color,
            }}
            className="pointer-events-none absolute inset-0 rounded-[inherit] border opacity-40 transition-all duration-300"
            aria-hidden="true"
          />
        </span>
      ) : parsed.type === "vector" && parsed.vectorId ? (
        /* Vector Security Badge with Color Theme */
        <span
          style={{
            backgroundColor: colorPreset.bg,
            color: colorPreset.color,
            borderColor: colorPreset.border,
            boxShadow: colorPreset.glow,
          }}
          className={cn(
            "flex shrink-0 items-center justify-center border-2 shadow-sm transition-all duration-300",
            boxClasses,
            className
          )}
        >
          {parsed.vectorId === "vector:shield" && <Shield className={iconSize} aria-hidden="true" />}
          {parsed.vectorId === "vector:cpu" && <Cpu className={iconSize} aria-hidden="true" />}
          {parsed.vectorId === "vector:radar" && <Radio className={iconSize} aria-hidden="true" />}
          {parsed.vectorId === "vector:lock" && <KeyRound className={iconSize} aria-hidden="true" />}
          {parsed.vectorId === "vector:terminal" && (
            <Terminal className={TERMINAL_ICON_SIZE_MAP[size] || iconSize} aria-hidden="true" />
          )}
          {parsed.vectorId === "vector:sparkles" && <Sparkles className={iconSize} aria-hidden="true" />}
        </span>
      ) : isEmoji ? (
        /* Legacy Emoji Fallback */
        <span
          className={cn(
            "flex shrink-0 items-center justify-center border border-border/80 bg-muted/40 text-foreground shadow-sm",
            boxClasses,
            className
          )}
        >
          <span className={cn("leading-none select-none", EMOJI_SIZE_MAP[size])}>
            {avatar}
          </span>
        </span>
      ) : (
        /* Monogram Initial Avatar with Color Theme */
        <span
          style={{
            backgroundColor: colorPreset.bg,
            color: colorPreset.color,
            borderColor: colorPreset.border,
            boxShadow: colorPreset.glow,
          }}
          className={cn(
            "flex shrink-0 items-center justify-center border-2 shadow-sm font-mono transition-all duration-300",
            boxClasses,
            className
          )}
        >
          <span className="leading-none select-none tracking-tight font-bold">{initials}</span>
        </span>
      )}

      {/* Dynamic Status Sphere/Dot matching the selected Color Theme */}
      {showStatusIndicator && (
        <span
          style={{
            backgroundColor: statusOnline ? colorPreset.color : undefined,
            boxShadow: statusOnline ? `0 0 8px ${colorPreset.color}` : undefined,
          }}
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-background shadow-xs transition-all duration-300",
            !statusOnline && "bg-muted-foreground",
            size === "sm" && "h-2.5 w-2.5",
            size === "md" && "h-3 w-3",
            (size === "lg" || size === "xl") && "h-3.5 w-3.5"
          )}
          title={statusOnline ? `Active (${colorPreset.name})` : "Offline"}
        />
      )}
    </div>
  );
}
