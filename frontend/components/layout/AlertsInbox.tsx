"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Bell, ExternalLink, CheckCircle2 } from "lucide-react";
import type { Alert } from "@/lib/types";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { verdictSummary } from "@/lib/verdict";
import { formatDateTime, safeTimestamp } from "@/lib/dates";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchFromBackend } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AlertsInboxProps {
  open: boolean;
  onClose: () => void;
  alerts: Alert[];
  loading: boolean;
}

export function AlertsInbox({ open, onClose, alerts, loading }: AlertsInboxProps) {
  const router = useRouter();
  // WS-3.3 incident workflow: locally track alerts the operator resolved.
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const resolveAlert = async (alertId: string) => {
    setResolved((prev) => new Set(prev).add(alertId));
    await fetchFromBackend(`/api/v1/alerts/${alertId}/status?status=RESOLVED`, {
      method: "PATCH",
      silent: true,
    });
  };

  const sorted = [...alerts].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    // Unknown severities sort last instead of producing NaN.
    const diff = (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
    if (diff !== 0) return diff;
    return safeTimestamp(b.triggered_at) - safeTimestamp(a.triggered_at);
  });
  const visible = sorted.filter(
    (a) => a.status !== "RESOLVED" && !resolved.has(a.id)
  );

  const openReplay = (sessionId: string) => {
    onClose();
    router.push(`/replay?session=${sessionId}`);
  };

  // Representative score per severity band so alerts get the same plain-language
  // "what we did" line as the rest of the product (see lib/verdict).
  const scoreForSeverity: Record<Alert["severity"], number> = {
    CRITICAL: 90,
    HIGH: 70,
    MEDIUM: 45,
    LOW: 20,
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        aria-label="Close alerts inbox"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Alerts inbox"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold">Alerts Inbox</h2>
            {alerts.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {alerts.length}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All clear"
              description="No unresolved alerts."
              className="border-0 bg-transparent py-12"
            />
          ) : (
            <ul className="space-y-2">
              {visible.map((alert) => (
                <li key={alert.id} className="rounded-lg border border-border bg-muted/20">
                  <button
                    type="button"
                    className={cn(
                      "w-full rounded-lg p-4 text-left transition-colors hover:bg-muted/40",
                      alert.severity === "CRITICAL" && "border-l-4 border-l-severity-critical"
                    )}
                    onClick={() => openReplay(alert.session_id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{alert.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{alert.message}</p>
                        <p className="mt-1.5 text-xs text-foreground">
                          {
                            verdictSummary({
                              riskScore: scoreForSeverity[alert.severity],
                            }).whatWeDid
                          }
                        </p>
                        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                          {alert.agent_id} · {formatDateTime(alert.triggered_at)}
                        </p>
                      </div>
                      <SeverityBadge severity={alert.severity} />
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs text-foreground">
                      Open replay <ExternalLink className="h-3 w-3" />
                    </span>
                  </button>
                  <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs"
                      onClick={() => resolveAlert(alert.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Resolve
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </aside>
    </div>
  );
}
