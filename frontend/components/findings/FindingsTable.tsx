"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Search,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  X,
} from "lucide-react";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ExtendedFinding } from "@/lib/types/findings";
import { cn } from "@/lib/utils";

type SortKey = "timestamp" | "severity" | "status" | "title" | "impact";

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const STATUS_LABELS: Record<string, string> = {
  new: "New Triage",
  validated: "Validated",
  sandboxed: "Sandboxed",
  promoted: "Promoted to Playbook",
  deployed: "Enforced",
};

interface FindingsTableProps {
  rows: ExtendedFinding[];
  loading?: boolean;
  selectedId?: string | null;
  onSelect?: (row: ExtendedFinding) => void;
}

export function FindingsTable({
  rows,
  loading,
  selectedId,
  onSelect,
}: FindingsTableProps) {
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [agentFilter, setAgentFilter] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [sortAsc, setSortAsc] = useState(false);

  // Distinct agent list for dropdown
  const agents = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.target_agent) set.add(r.target_agent);
    });
    return Array.from(set);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;

    if (severityFilter !== "ALL") {
      list = list.filter((r) => r.severity.toUpperCase() === severityFilter);
    }
    if (statusFilter !== "ALL") {
      list = list.filter((r) => r.status.toLowerCase() === statusFilter.toLowerCase());
    }
    if (agentFilter !== "ALL") {
      list = list.filter((r) => r.target_agent === agentFilter);
    }
    if (q) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          (r.asi_code ?? "").toLowerCase().includes(q) ||
          (r.mitre_atlas ?? "").toLowerCase().includes(q) ||
          (r.target_agent ?? "").toLowerCase().includes(q) ||
          (r.attack_prompt ?? "").toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "severity":
          cmp = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
          break;
        case "impact":
          cmp = (b.impact_score ?? 0) - (a.impact_score ?? 0);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        default:
          cmp = (Date.parse(b.timestamp ?? "") || 0) - (Date.parse(a.timestamp ?? "") || 0);
      }
      return sortAsc ? -cmp : cmp;
    });
  }, [rows, query, severityFilter, statusFilter, agentFilter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100" />
        <div className="h-64 w-full animate-pulse rounded-lg bg-slate-50" />
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Search and Multi-Faceted Filter Ribbon */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Live Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by threat, vector payload, ASI code, or MITRE ATLAS..."
              className="h-9 pl-9 pr-7 text-xs border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Agent Fleet Selector */}
          {agents.length > 0 && (
            <div className="flex items-center gap-1.5 font-mono text-xs text-slate-600">
              <span className="text-[11px] text-slate-500">Agent:</span>
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="h-8 rounded border border-slate-200 bg-white px-2 font-mono text-xs font-semibold text-slate-800 shadow-2xs focus:border-slate-900 focus:outline-hidden"
              >
                <option value="ALL">All Fleet Agents ({rows.length})</option>
                {agents.map((ag) => (
                  <option key={ag} value={ag}>
                    {ag}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Filter Pills (Severity + Status) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          {/* Severity Pills */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
              Severity:
            </span>
            {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={cn(
                  "rounded px-2.5 py-0.5 font-mono text-[11px] font-semibold transition-all",
                  severityFilter === sev
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-slate-100/80 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                )}
              >
                {sev === "ALL" ? "All" : sev}
              </button>
            ))}
          </div>

          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
              Status:
            </span>
            {(["ALL", "new", "validated", "promoted", "sandboxed"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "rounded px-2.5 py-0.5 font-mono text-[11px] font-semibold capitalize transition-all",
                  statusFilter === st
                    ? "bg-black text-white shadow-2xs"
                    : "bg-slate-100/80 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                )}
              >
                {st === "ALL" ? "All" : st === "promoted" ? "Hotpatched" : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile / Compact Card View (< md screens) */}
      <div className="md:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200/90 bg-white p-8 text-center text-xs font-mono text-slate-500">
            No vulnerability findings match this filter query.
          </div>
        ) : (
          filtered.map((row) => {
            const isSelected = selectedId === row.id;
            const isBreached = row.verdict?.toUpperCase() === "BREACHED";

            return (
              <div
                key={row.id}
                onClick={() => onSelect?.(row)}
                className={cn(
                  "rounded-xl border p-3.5 bg-white transition-all shadow-2xs cursor-pointer active:scale-[0.99]",
                  isSelected
                    ? "border-slate-900 ring-2 ring-slate-900/10 bg-slate-50"
                    : "border-slate-200/90 hover:border-slate-300"
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600">
                    <span className="font-bold text-slate-800">{row.id}</span>
                    <span className="text-slate-300">·</span>
                    <span>{row.asi_code ?? row.category}</span>
                  </div>
                  <SeverityBadge severity={row.severity} />
                </div>

                <p className="font-semibold text-xs text-slate-900 leading-snug mb-1.5">
                  {row.title}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 font-mono text-[11px] text-slate-500">
                  <span className="truncate max-w-[150px] font-medium text-slate-700">{row.target_agent}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-bold uppercase text-[10px]",
                        isBreached ? "text-rose-600" : "text-emerald-600"
                      )}
                    >
                      {row.verdict ?? "UNCLASSIFIED"}
                    </span>
                    <span className="text-xs font-semibold text-slate-900 flex items-center">
                      Inspect <ChevronRight className="h-3 w-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Main High-Density Table (hidden on mobile, visible on md+) */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="border-b border-slate-200/90 bg-slate-50/80 font-mono text-[11px] uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                  onClick={() => toggleSort("title")}
                >
                  Vulnerability &amp; Exploit Vector
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </th>
              <th className="px-3 py-3 font-semibold w-28">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                  onClick={() => toggleSort("severity")}
                >
                  Severity
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </th>
              <th className="px-3 py-3 font-semibold w-36">Framework &amp; ATLAS</th>
              <th className="px-3 py-3 font-semibold w-32">Target Agent</th>
              <th className="px-3 py-3 font-semibold w-28">Status</th>
              <th className="px-3 py-3 font-semibold w-28">Verdict</th>
              <th className="px-3 py-3 font-semibold w-28">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                  onClick={() => toggleSort("timestamp")}
                >
                  Discovered
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </th>
              <th className="px-4 py-3 font-semibold text-right w-24">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-500 font-mono text-xs">
                  No vulnerability findings match this filter query.
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-slate-200"
                      onClick={() => {
                        setQuery("");
                        setSeverityFilter("ALL");
                        setStatusFilter("ALL");
                        setAgentFilter("ALL");
                      }}
                    >
                      Reset Filters
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const isSelected = selectedId === row.id;
                const isContained = row.verdict?.toUpperCase() === "CONTAINED";
                const isBreached = row.verdict?.toUpperCase() === "BREACHED";

                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelect?.(row)}
                    className={cn(
                      "group cursor-pointer transition-colors hover:bg-slate-50/80",
                      isSelected && "bg-slate-100",
                    )}
                  >
                    {/* Column 1: Title & Exploit Summary */}
                    <td className="px-4 py-3.5 max-w-[340px]">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-mono text-[10px] font-bold text-slate-500">
                          {row.id}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-[10px] text-slate-600 truncate">
                          {row.category}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900 group-hover:text-slate-950 transition-colors leading-snug">
                        {row.title}
                      </p>
                      {row.remediation_hint && (
                        <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">
                          Fix: {row.remediation_hint}
                        </p>
                      )}
                    </td>

                    {/* Column 2: Severity */}
                    <td className="px-3 py-3.5">
                      <SeverityBadge severity={row.severity} />
                      {row.impact_score && (
                        <span className="block mt-0.5 font-mono text-[10px] text-slate-400">
                          Score: {row.impact_score}/100
                        </span>
                      )}
                    </td>

                    {/* Column 3: Framework Taxonomy (ASI / OWASP + ATLAS) */}
                    <td className="px-3 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        {row.asi_code && (
                          <Badge
                            variant="outline"
                            className="border-slate-200 bg-slate-50 font-mono text-[10px] font-bold text-slate-700 w-fit"
                          >
                            {row.asi_code}
                          </Badge>
                        )}
                        {row.mitre_atlas && (
                          <span className="font-mono text-[10px] text-slate-500">
                            {row.mitre_atlas}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 4: Target Agent */}
                    <td className="px-3 py-3.5">
                      <span className="font-mono text-[11px] font-bold text-slate-700 block truncate max-w-[130px]" title={row.target_agent}>
                        {row.target_agent ?? "autonomous-copilot"}
                      </span>
                      {row.namespace && (
                        <span className="font-mono text-[9px] text-slate-400 block truncate max-w-[130px]">
                          {row.namespace}
                        </span>
                      )}
                    </td>

                    {/* Column 5: Status */}
                    <td className="px-3 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold",
                          row.status === "promoted"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : row.status === "new"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        )}
                      >
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                      {row.playbook_version && (
                        <span className="block mt-0.5 font-mono text-[9px] text-slate-500">
                          Playbook v{row.playbook_version}
                        </span>
                      )}
                    </td>

                    {/* Column 6: Verdict */}
                    <td className="px-3 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase",
                          isContained
                            ? "text-emerald-700"
                            : isBreached
                            ? "text-rose-700"
                            : "text-amber-700"
                        )}
                      >
                        {isContained ? (
                          <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <ShieldAlert className="h-3 w-3 text-rose-600" />
                        )}
                        {row.verdict ?? "UNKNOWN"}
                      </span>
                    </td>

                    {/* Column 7: Timestamp */}
                    <td className="px-3 py-3.5 font-mono text-[11px] text-slate-500">
                      {row.timestamp
                        ? new Date(row.timestamp).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>

                    {/* Column 8: Action Trigger */}
                    <td className="px-4 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-slate-200 font-mono text-[11px] font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-950 shadow-2xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect?.(row);
                        }}
                      >
                        Inspect
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between font-mono text-xs text-slate-500 px-1">
        <span>
          Showing {filtered.length} of {rows.length} security finding{rows.length === 1 ? "" : "s"}
        </span>
        <span className="text-[11px] text-slate-400">
          Click any row to open forensic triage &amp; policy synthesis drawer
        </span>
      </div>
    </div>
  );
}
