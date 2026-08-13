"use client";

import { cn } from "@/lib/utils";

/* ── ARTSA Logo — SVG icon + wordmark ─────────────────────────────────── */

interface LogoProps {
  /** Render only the shield icon */
  iconOnly?: boolean;
  /** Render only the wordmark text */
  wordmarkOnly?: boolean;
  /** Additional class names */
  className?: string;
  /** Icon size in rem — defaults to 1.5rem */
  iconSize?: number;
}

export function LogoIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-label="ARTSA"
    >
      {/* Outer shield shape */}
      <path
        d="M24 4L6 11V24.5C6 33.5 14 41 24 44C34 41 42 33.5 42 24.5V11L24 4Z"
        fill="url(#artsa-grad-bg)"
        stroke="url(#artsa-grad-stroke)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Inner chevron / A symbol */}
      <path
        d="M24 14L14 30H19L24 22L29 30H34L24 14Z"
        fill="url(#artsa-grad-fg)"
      />
      {/* Center scanline */}
      <line
        x1="18"
        y1="36"
        x2="30"
        y2="36"
        stroke="url(#artsa-grad-fg)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Top accent dots */}
      <circle cx="24" cy="10" r="1.2" fill="currentColor" opacity="0.6" />
      <circle cx="19" cy="11.5" r="0.8" fill="currentColor" opacity="0.35" />
      <circle cx="29" cy="11.5" r="0.8" fill="currentColor" opacity="0.35" />

      <defs>
        <linearGradient id="artsa-grad-bg" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(225 95% 12%)" />
          <stop offset="1" stopColor="hsl(225 95% 18%)" />
        </linearGradient>
        <linearGradient id="artsa-grad-stroke" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(225 95% 50%)" />
          <stop offset="1" stopColor="hsl(200 85% 40%)" />
        </linearGradient>
        <linearGradient id="artsa-grad-fg" x1="14" y1="14" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(225 95% 72%)" />
          <stop offset="1" stopColor="hsl(200 85% 55%)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function LogoWordmark({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size * 5.5}
      height={size * 0.9}
      viewBox="0 0 132 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-label="ARTSA"
    >
      <text
        x="0"
        y="19"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
        fontSize="20"
        letterSpacing="-0.02em"
        fill="url(#artsa-wm-grad)"
      >
        ARTSA
      </text>
      <defs>
        <linearGradient id="artsa-wm-grad" x1="0" y1="0" x2="132" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(225 95% 72%)" />
          <stop offset="1" stopColor="hsl(200 85% 55%)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Logo({ iconOnly, wordmarkOnly, className, iconSize = 24 }: LogoProps) {
  if (wordmarkOnly) {
    return <LogoWordmark className={className} size={iconSize} />;
  }

  if (iconOnly) {
    return <LogoIcon className={className} size={iconSize} />;
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoIcon size={iconSize} />
      <LogoWordmark size={iconSize} />
    </div>
  );
}
