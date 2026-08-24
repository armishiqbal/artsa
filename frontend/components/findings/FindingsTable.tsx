"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ServerFinding } from "@/lib/hooks/useFindings";
import { cn } from "@/lib/utils";

type SortKey = "timestamp" | "severity" | "status" | "title";

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  validated: "Validated",
  sandboxed: "Sandboxed",
  promoted: "Promoted",
  deployed: "Deployed",
};

const STATUS_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "new", label: "New" },
  { value: "validated", label: "Validated" },
  { value: "promoted", label: "Promoted" },
];

interface FindingsTableProps {
  rows: ServerFinding[];
  loading?: boolean;
  selectedId?: string | null;
  onSelect?: (row: ServerFinding) => void;
}

export function FindingsTable({ rows, loading, selectedId, onSelect }: FindingsTableProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;
    if (statusFilter !== "ALL") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (q) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          (r.asi_code ?? "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "severity":
          cmp = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        default:
          cmp =
            (Date.parse(b.timestamp ?? "") || 0) - (Date.parse(a.timestamp ?? "") || 0);
      }
      return sortAsc ? -cmp : cmp;
    });
  }, [rows, query, statusFilter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/20" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by title, category, ASI…"
          className="max-w-sm"
          aria-label="Filter findings"
        />
        <SegmentedControl value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-muted/20 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              {(
                [
                  ["title", "Finding"],
                  ["severity", "Severity"],
                  ["timestamp", "When"],
                  ["status", "Status"],
                ] as const
              ).map(([key, label]) => (
                <th key={key} className="px-3 py-2.5 font-medium">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort(key)}
                  >
                    {label}
                    <ArrowUpDown className="h-3 w-3 opacity-60" aria-hidden />
                  </button>
                </th>
              ))}
              <th className="px-3 py-2.5 font-medium">ASI</th>
              <th className="px-3 py-2.5 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-muted-foreground">
                  No findings match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const selected = selectedId === row.id;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "hover:bg-muted/10",
                      selected && "bg-muted/20",
                      onSelect && "cursor-pointer"
                    )}
                    onClick={() => onSelect?.(row)}
                  >
                    <td className="px-3 py-3">
                      <p className="font-medium text-foreground">{row.title}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.category}</p>
                    </td>
                    <td className="px-3 py-3">
                      <SeverityBadge severity={row.severity} />
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">
                      {row.timestamp
                        ? new Date(row.timestamp).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="secondary" className="meta-badge">
                        {STATUS_LABELS[row.status] ?? row.status}
                      </Badge>
                      {row.playbook_version ? (
                        <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                          v{row.playbook_version}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {row.asi_code ? (
                        <Badge variant="outline" className="meta-badge font-mono text-[10px]">
                          {row.asi_code}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="interactive-pill h-7 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link href={row.source === "campaign" ? "/campaigns" : "/logs"}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {rows.length} finding{rows.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
