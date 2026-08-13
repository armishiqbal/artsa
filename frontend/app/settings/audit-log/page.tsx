"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ScrollText,
  Search,
  Clock,
  User,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  detail: string;
  tenant_id: string;
}

const actionColors: Record<string, string> = {
  system_started: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  provider_added: "bg-status-success/10 text-status-success border-status-success/30",
  guardrail_configured: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  notifications_updated: "bg-status-warning/10 text-status-warning border-status-warning/30",
  notification_test: "bg-status-warning/10 text-status-warning border-status-warning/30",
  team_member_added: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  team_member_updated: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  team_member_removed: "bg-destructive/10 text-destructive border-destructive/30",
};

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit) });
    if (actionFilter) params.set("action", actionFilter);
    fetchFromBackend<{ entries?: AuditEntry[]; total?: number; actions?: string[] }>(
      `/api/v1/settings/audit-log?${params.toString()}`,
      { silent: true }
    ).then((d) => {
      if (d?.entries) setEntries(d.entries);
      if (d?.total != null) setTotal(d.total);
      if (d?.actions) setActions(d.actions);
      setLoading(false);
    });
  }, [limit, actionFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.action.toLowerCase().includes(q) ||
      e.actor.toLowerCase().includes(q) ||
      e.resource.toLowerCase().includes(q) ||
      e.detail.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit Log"
        description="Complete record of configuration changes, system events, and user actions."
        icon={<ScrollText className="h-5 w-5" />}
        actions={
          <div className="flex gap-2">
            <Badge variant="info" className="font-mono text-[10px]">{total} events</Badge>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={actionFilter === null ? "default" : "ghost"}
            size="sm"
            className="text-xs"
            onClick={() => setActionFilter(null)}
          >
            All
          </Button>
          {actions.map((action) => (
            <Button
              key={action}
              variant={actionFilter === action ? "default" : "ghost"}
              size="sm"
              className="text-xs"
              onClick={() => setActionFilter(action)}
            >
              {formatAction(action)}
            </Button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <DashboardCard title="Event Timeline" badge={<Clock className="h-4 w-4 text-muted-foreground" />}>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading audit log...</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No audit events match your filters.</p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

            <div className="space-y-1">
              {filtered.map((entry) => {
                const colorClass = actionColors[entry.action] ?? "bg-muted text-muted-foreground border-border";
                return (
                  <div key={entry.id} className="relative flex gap-4 py-2 pl-10">
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        "absolute left-[11px] top-3.5 h-[17px] w-[17px] rounded-full border-2 bg-background",
                        entry.action.includes("removed") || entry.action.includes("error")
                          ? "border-red-400"
                          : "border-status-success"
                      )}
                    />

                    <div className="min-w-0 flex-1 rounded-lg border border-border/50 bg-card/40 p-3 transition-colors hover:border-border">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge className={cn("border font-mono text-[10px]", colorClass)}>
                              {formatAction(entry.action)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(entry.timestamp)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm">{entry.detail}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {entry.actor}
                        </div>
                      </div>
                      {entry.resource && (
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                          {entry.resource}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {total > limit && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 50)}>
              Load more <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </DashboardCard>
    </div>
  );
}
