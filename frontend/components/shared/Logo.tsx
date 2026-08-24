"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  iconOnly?: boolean;
  wordmarkOnly?: boolean;
  className?: string;
  iconSize?: number;
}

/** ARTSA mark — monochrome shield with cornflower accent (Dovetail). */
export function LogoIcon({ className, size = 26 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        d="M18 3 L31 8.5 V18 C31 25.5 25.5 31.5 18 34 C10.5 31.5 5 25.5 5 18 V8.5 L18 3 Z"
        fill="#0a0a0a"
        stroke="#6798ff"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M18 6.5 L28 10.8 V17.5 C28 23.5 23.8 28.5 18 30.5 C12.2 28.5 8 23.5 8 17.5 V10.8 L18 6.5 Z"
        fill="none"
        stroke="#313131"
        strokeWidth="0.8"
      />
      <path
        d="M18 10.5 L11.5 24.5 H14.5 L16.2 20.8 H19.8 L21.5 24.5 H24.5 L18 10.5 Z M17.2 18.5 L18 14.5 L18.8 18.5 H17.2 Z"
        fill="#ffffff"
      />
      <circle cx="18" cy="16.5" r="1.5" fill="#6798ff" />
    </svg>
  );
}

export function LogoWordmark({
  className,
  size = 26,
}: {
  className?: string;
  size?: number;
}) {
  const fontSize = Math.round(size * 0.74);

  return (
    <div className={cn("inline-flex items-center gap-2 select-none", className)}>
      <span
        style={{ fontSize: `${fontSize}px` }}
        className="font-semibold tracking-[-0.02em] text-foreground"
      >
        ARTSA
      </span>
      <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] font-normal uppercase tracking-[0.85px] text-muted-foreground">
        EDS
      </span>
    </div>
  );
}

export default function Logo({
  iconOnly = false,
  wordmarkOnly = false,
  className,
  iconSize = 26,
}: LogoProps) {
  if (iconOnly) {
    return <LogoIcon size={iconSize} className={className} />;
  }

  if (wordmarkOnly) {
    return <LogoWordmark size={iconSize} className={className} />;
  }

  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoIcon size={iconSize} />
      <LogoWordmark size={iconSize} />
    </div>
  );
}
