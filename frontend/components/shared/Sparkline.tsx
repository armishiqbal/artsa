"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
  variant?: "primary" | "success" | "warning" | "critical";
}

const variantColors: Record<string, string> = {
  primary: "hsl(var(--foreground) / 0.55)",
  success: "hsl(var(--foreground) / 0.45)",
  warning: "hsl(var(--foreground) / 0.45)",
  critical: "hsl(var(--foreground) / 0.55)",
};

export function Sparkline({
  data,
  width = 80,
  height = 24,
  strokeWidth = 1.5,
  className,
  variant = "primary",
}: SparklineProps) {
  const pathD = useMemo(() => {
    if (data.length < 2) return "";
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const paddingX = 1;
    const usableWidth = width - paddingX * 2;
    const step = usableWidth / (data.length - 1);

    const points = data.map((val, i) => {
      const x = paddingX + i * step;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    return points.join(" ");
  }, [data, width, height]);

  if (data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        className={cn("shrink-0", className)}
        aria-hidden
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="hsl(var(--muted-foreground) / 0.2)"
          strokeWidth={strokeWidth}
        />
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      className={cn("shrink-0", className)}
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
    >
      <path
        d={pathD}
        fill="none"
        stroke={variantColors[variant]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
