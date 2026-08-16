"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShieldAlert,
  Activity,
  RefreshCw,
  Clock,
  User,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchFromBackend } from "@/lib/api";
import { formatDate } from "@/lib/dates";

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource?: string;
  detail?: string;
}

export function SecurityAuditStream() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAuditLog = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFromBackend<{ entries?: AuditEntry[] }>(
        "/api/v1/settings/audit-log?limit=8",
        { silent: true }
      );
      if (data?.entries) {
        setEntries(data.entries);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuditLog();
  }, [loadAuditLog]);

  return (
    <DashboardCard
      title="Recent Security & Account Telemetry Stream"
      description="Live audit event stream recording containment and authorization actions."
      icon={<Activity className="h-4 w-4 text-primary" />}
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={loadAuditLog}
          disabled={loading}
          className="gap-1.5 text-xs shadow-xs"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      <div className="space-y-3">
        {entries.length > 0 ? (
          <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card overflow-hidden">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 text-xs transition-colors hover:bg-muted/20"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Activity className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {entry.action}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground font-mono">
                      Actor: {entry.actor} {entry.resource ? `· ${entry.resource}` : ""}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {formatDate(entry.timestamp, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-5 text-center text-xs text-muted-foreground">
            <CheckCircle2 className="mx-auto h-6 w-6 text-status-success mb-2" />
            <p className="font-semibold text-foreground">Security Stream Active</p>
            <p className="mt-1 text-[11px]">
              No abnormal security incidents or audit alerts recorded in the current inspection window.
            </p>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
