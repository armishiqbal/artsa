"use client";

import { cn } from "@/lib/utils";

export type TelemetryHealth = "LIVE" | "DEGRADED" | "STALE" | "DISCONNECTED" | "SIMULATION";

export function CommandCenterCampaignContext({
  campaignName = "No campaign selected",
  sessionId = "No active session",
  targetName = "No target selected",
  roundNumber = 1,
  apiOnline = true,
  wsConnected = true,
  isPaused = false,
  telemetryState: telemetryOverride,
  lastEventAt = null,
  className,
}: {
  campaignName?: string;
  sessionId?: string;
  targetName?: string;
  roundNumber?: number;
  apiOnline?: boolean;
  wsConnected?: boolean;
  isPaused?: boolean;
  telemetryState?: TelemetryHealth;
  lastEventAt?: string | null;
  className?: string;
}) {
  const currentHealth: TelemetryHealth =
    telemetryOverride ??
    (apiOnline && wsConnected
      ? "LIVE"
      : apiOnline && !wsConnected
        ? "DEGRADED"
        : !apiOnline && wsConnected
          ? "DISCONNECTED"
          : "SIMULATION");

  const parsedEventTime = lastEventAt ? new Date(lastEventAt) : null;
  const lastEventLabel = parsedEventTime && Number.isFinite(parsedEventTime.getTime())
    ? parsedEventTime.toLocaleTimeString(undefined, { hour12: false })
    : currentHealth === "SIMULATION" ? "sample timeline" : "Unavailable";

  const healthStyle =
    currentHealth === "LIVE"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : currentHealth === "DEGRADED"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : currentHealth === "DISCONNECTED"
          ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
          : "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400";

  const dotColor =
    currentHealth === "LIVE"
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
      : currentHealth === "DEGRADED"
        ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
        : currentHealth === "DISCONNECTED"
          ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
          : "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]";

  return (
    <section
      aria-label="Campaign and Operational Identity"
      className={cn(
        "flex flex-wrap items-center justify-between gap-y-3 gap-x-6 rounded-xl border border-border/80 bg-background px-4 py-3 sm:px-5 sm:py-4 text-[11px] shadow-2xs",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono">
        {/* Campaign */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            CAMPAIGN
          </span>
          <span className="font-semibold text-foreground tracking-tight">
            {campaignName}
          </span>
        </div>

        <span className="hidden sm:inline text-border">/</span>

        {/* Session */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            SESSION
          </span>
          <span className="text-foreground/90 font-medium">
            {sessionId}
          </span>
        </div>

        <span className="hidden md:inline text-border">/</span>

        {/* Target */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            TARGET
          </span>
          <span className="text-foreground/90 font-medium">
            {targetName}
          </span>
        </div>

        <span className="hidden lg:inline text-border">/</span>

        {/* Round */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            ROUND
          </span>
          <span className="font-semibold text-foreground">
            R{roundNumber}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
        {/* Telemetry Status Indicator */}
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold uppercase tracking-wider",
            healthStyle
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
          {currentHealth}
        </span>

        {currentHealth === "SIMULATION" ? (
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 uppercase tracking-wider font-semibold",
              isPaused
                ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
            )}
          >
            {isPaused ? "PAUSED" : "PLAYING"}
          </span>
        ) : null}

        <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground pl-1 border-l border-border">
          <span className="text-[9px] uppercase">EVENT:</span>
          <span className="text-foreground font-medium tabular-nums">{lastEventLabel}</span>
        </div>
      </div>
    </section>
  );
}
