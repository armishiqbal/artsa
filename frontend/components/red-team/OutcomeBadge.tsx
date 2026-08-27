"use client";

import { cn } from "@/lib/utils";

/** v2 axes — Detection / Prevention / Leak / Result. */
export type DetectionValue = "detected" | "late" | "missed";
export type PreventionValue = "prevented" | "partial" | "failed";
export type LeakValue = "none" | "attempted" | "confirmed";
export type ResultValue = "pass" | "risk" | "fail" | "critical";

/** Legacy aliases still used across pages. */
export type SecurityOutcome =
  | "attack_succeeded"
  | "detection_failed"
  | "data_leaked"
  | "safe"
  | "blocked"
  | "late"
  | "risk"
  | DetectionValue
  | PreventionValue
  | LeakValue
  | ResultValue;

const STYLES: Record<string, { label: string; className: string }> = {
  // Detection
  detected: {
    label: "Detected",
    className:
      "border-[hsl(var(--severity-low-border))] bg-[hsl(var(--severity-low-subtle))] text-[hsl(var(--severity-low))]",
  },
  late: {
    label: "Late",
    className:
      "border-[hsl(var(--severity-medium-border))] bg-[hsl(var(--severity-medium-subtle))] text-[hsl(var(--severity-medium))]",
  },
  missed: {
    label: "Missed",
    className:
      "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))] text-[hsl(var(--severity-critical))]",
  },
  // Prevention
  prevented: {
    label: "Prevented",
    className:
      "border-[hsl(var(--severity-low-border))] bg-[hsl(var(--severity-low-subtle))] text-[hsl(var(--severity-low))]",
  },
  partial: {
    label: "Partial",
    className:
      "border-[hsl(var(--severity-medium-border))] bg-[hsl(var(--severity-medium-subtle))] text-[hsl(var(--severity-medium))]",
  },
  failed: {
    label: "Failed",
    className:
      "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))] text-[hsl(var(--severity-critical))]",
  },
  // Leak
  none: {
    label: "None",
    className:
      "border-[hsl(var(--severity-low-border))] bg-[hsl(var(--severity-low-subtle))] text-[hsl(var(--severity-low))]",
  },
  attempted: {
    label: "Attempted",
    className:
      "border-[hsl(var(--severity-medium-border))] bg-[hsl(var(--severity-medium-subtle))] text-[hsl(var(--severity-medium))]",
  },
  confirmed: {
    label: "Confirmed",
    className:
      "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))] text-[hsl(var(--severity-critical))]",
  },
  // Result
  pass: {
    label: "Pass",
    className:
      "border-[hsl(var(--severity-low-border))] bg-[hsl(var(--severity-low-subtle))] text-[hsl(var(--severity-low))]",
  },
  risk: {
    label: "Risk",
    className:
      "border-[hsl(var(--severity-high-border))] bg-[hsl(var(--severity-high-subtle))] text-[hsl(var(--severity-high))]",
  },
  fail: {
    label: "Fail",
    className:
      "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))] text-[hsl(var(--severity-critical))]",
  },
  critical: {
    label: "Critical",
    className:
      "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))] text-[hsl(var(--severity-critical))]",
  },
  // Legacy
  attack_succeeded: {
    label: "Attack succeeded",
    className:
      "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))] text-[hsl(var(--severity-critical))]",
  },
  detection_failed: {
    label: "Detection failed",
    className:
      "border-[hsl(var(--severity-medium-border))] bg-[hsl(var(--severity-medium-subtle))] text-[hsl(var(--severity-medium))]",
  },
  data_leaked: {
    label: "Data leaked",
    className:
      "border-[hsl(var(--severity-critical-border))] bg-[hsl(var(--severity-critical-subtle))] text-[hsl(var(--severity-critical))]",
  },
  safe: {
    label: "Safe",
    className:
      "border-[hsl(var(--severity-low-border))] bg-[hsl(var(--severity-low-subtle))] text-[hsl(var(--severity-low))]",
  },
  blocked: {
    label: "Blocked",
    className:
      "border-[hsl(var(--severity-low-border))] bg-[hsl(var(--severity-low-subtle))] text-[hsl(var(--severity-low))]",
  },
};

export function OutcomeBadge({
  outcome,
  kind,
  value,
  size = "sm",
  className,
}: {
  outcome?: SecurityOutcome | string;
  kind?: "detection" | "prevention" | "leak" | "result";
  value?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const key = (value || outcome || "risk") as string;
  const s = STYLES[key] ?? {
    label: key,
    className: "border-border bg-muted/40 text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border font-semibold uppercase tracking-wide",
        size === "md" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]",
        s.className,
        className
      )}
      data-kind={kind}
    >
      {s.label}
    </span>
  );
}
