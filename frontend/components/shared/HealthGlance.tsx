"use client";

import {
  ShieldCheck,
  Wifi,
  WifiOff,
  Activity,
  Zap,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface HealthGlanceProps {
  apiOnline: boolean;
  wsConnected: boolean;
  defenseScore: number;
  activeSessions: number;
  eventRate: number;
  totalEvents: number;
  criticalCount: number;
}

function HealthPill({
  label,
  value,
  icon: Icon,
  status,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "healthy" | "warning" | "critical" | "neutral";
}) {
  const colors = {
    healthy: "border-border bg-muted/40 text-foreground",
    warning: "border-border bg-muted/40 text-muted-foreground",
    critical: "border-border bg-muted/50 text-foreground",
    neutral: "border-border bg-muted/30 text-muted-foreground",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        colors[status]
      )}
      title={label}
      aria-label={`${label}: ${value}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
      <span className="font-mono font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function HealthGlance({
  apiOnline,
  wsConnected,
  defenseScore,
  activeSessions,
  eventRate,
  totalEvents,
  criticalCount,
}: HealthGlanceProps) {
  const scoreFinite = Number.isFinite(defenseScore);
  const defenseStatus: "healthy" | "warning" | "critical" = !scoreFinite
    ? "warning"
    : defenseScore >= 90
      ? "healthy"
      : defenseScore >= 70
        ? "warning"
        : "critical";

  return (
    <div className="surface-panel flex flex-wrap items-center gap-2 px-4 py-2.5">
      {/* Connection status */}
      <HealthPill
        label="API"
        value={apiOnline ? "Online" : "Offline"}
        icon={apiOnline ? Wifi : WifiOff}
        status={apiOnline ? "healthy" : "critical"}
      />
      <HealthPill
        label="Stream"
        value={wsConnected ? "Live" : "Polling"}
        icon={wsConnected ? Zap : Clock}
        status={wsConnected ? "healthy" : "warning"}
      />

      <span className="h-5 w-px bg-border" aria-hidden />

      {/* Defense posture */}
      <HealthPill
        label="Defense"
        value={scoreFinite ? `${defenseScore.toFixed(0)}%` : "—"}
        icon={ShieldCheck}
        status={defenseStatus}
      />

      <span className="h-5 w-px bg-border" aria-hidden />

      {/* Session stats */}
      <HealthPill
        label="Sessions"
        value={String(activeSessions)}
        icon={Activity}
        status="neutral"
      />

      {/* Event rate */}
      <HealthPill
        label="Rate"
        value={`${eventRate}/m`}
        icon={Zap}
        status="neutral"
      />

      {/* Total events */}
      <span className="hidden text-xs text-muted-foreground md:inline font-mono">
        {totalEvents} events
      </span>

      {/* Critical alert indicator */}
      {criticalCount > 0 && (
        <>
          <span className="h-5 w-px bg-border" aria-hidden />
          <Badge variant="outline" className="gap-1 font-mono text-[10px]">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {criticalCount} critical
          </Badge>
        </>
      )}
    </div>
  );
}
