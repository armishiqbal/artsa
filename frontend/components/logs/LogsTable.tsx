"use client";

import { ArrowUp, ArrowDown, ArrowUpDown, X } from "lucide-react";
import type { LogRecord, DetectionResultType } from "@/lib/logsTypes";
import { cn } from "@/lib/utils";

interface LogsTableProps {
  rows: LogRecord[];
  selectedId: string | null;
  onSelectRow: (row: LogRecord) => void;
  onClearFilters: () => void;
  sortField: "timestamp" | "latency";
  sortOrder: "asc" | "desc";
  onToggleSort: (field: "timestamp" | "latency") => void;
  loading?: boolean;
}

function formatTimestamp(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return isoStr;
  }
}

function ThreatBadge({ threat }: { threat: DetectionResultType }) {
  if (threat === "No detections") {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        No detections
      </span>
    );
  }
  if (threat === "Prompt attack") {
    return (
      <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
        Prompt attack
      </span>
    );
  }
  if (threat === "Data leakage") {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        Data leakage
      </span>
    );
  }
  if (threat === "Dangerous Deviation") {
    return (
      <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
        Dangerous Deviation
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
      {threat}
    </span>
  );
}

export function LogsTable({
  rows,
  selectedId,
  onSelectRow,
  onClearFilters,
  sortField,
  sortOrder,
  onToggleSort,
  loading = false,
}: LogsTableProps) {
  return (
    <div className="relative mt-2 min-h-[460px] overflow-hidden rounded-lg border border-border/70 bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-[13px]">
          {/* Header matching Screenshot 2 */}
          <thead className="border-b border-border/70 bg-[#fafafa] font-normal text-muted-foreground dark:bg-muted/20">
            <tr>
              {/* 1. Timestamp ↑ */}
              <th
                scope="col"
                onClick={() => onToggleSort("timestamp")}
                className="cursor-pointer whitespace-nowrap px-4 py-3 select-none hover:text-foreground"
              >
                <div className="inline-flex items-center gap-1.5 font-medium">
                  <span>Timestamp</span>
                  {sortField === "timestamp" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp className="h-3.5 w-3.5 text-foreground" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5 text-foreground" />
                    )
                  ) : (
                    <ArrowUp className="h-3.5 w-3.5 opacity-60" />
                  )}
                </div>
              </th>

              {/* 2. Project */}
              <th scope="col" className="whitespace-nowrap px-3 py-3 font-medium">
                Project
              </th>

              {/* 3. Project mode */}
              <th scope="col" className="whitespace-nowrap px-3 py-3 font-medium">
                Project mode
              </th>

              {/* 4. Threats detected */}
              <th scope="col" className="whitespace-nowrap px-3 py-3 font-medium">
                Threats detected
              </th>

              {/* 5. Threat source */}
              <th scope="col" className="whitespace-nowrap px-3 py-3 font-medium">
                Threat source
              </th>

              {/* 6. Content */}
              <th scope="col" className="whitespace-nowrap px-3 py-3 font-medium">
                Content
              </th>

              {/* 7. Policy */}
              <th scope="col" className="whitespace-nowrap px-3 py-3 font-medium">
                Policy
              </th>

              {/* 8. Request ID */}
              <th scope="col" className="whitespace-nowrap px-3 py-3 font-medium">
                Request ID
              </th>

              {/* 9. Latency ⇅ */}
              <th
                scope="col"
                onClick={() => onToggleSort("latency")}
                className="cursor-pointer whitespace-nowrap px-3 py-3 select-none hover:text-foreground"
              >
                <div className="inline-flex items-center gap-1 font-medium">
                  <span>Latency</span>
                  {sortField === "latency" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp className="h-3.5 w-3.5 text-foreground" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5 text-foreground" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
                  )}
                </div>
              </th>

              {/* 10. Processing Region */}
              <th scope="col" className="whitespace-nowrap px-3 py-3 font-medium">
                Processing Region
              </th>

              {/* 11. Metadata tags */}
              <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">
                Metadata tags
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-border/50">
            {loading ? (
              // Loading skeleton
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`loading-${i}`} className="animate-pulse">
                  <td colSpan={11} className="h-12 px-4 py-2 bg-muted/10" />
                </tr>
              ))
            ) : rows.length === 0 ? (
              // Empty State matching Screenshot 2 pixel for pixel
              <tr>
                <td colSpan={11} className="py-36 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <p className="text-[13px] font-medium text-foreground">
                      No results found
                    </p>
                    <button
                      type="button"
                      onClick={() => onClearFilters()}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
                    >
                      <X className="h-3 w-3" />
                      Clear all filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              // Populated Rows
              rows.map((row) => {
                const isSelected = selectedId === row.id;
                const hasThreat = row.threatsDetected.some(
                  (t) => t !== "No detections"
                );

                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelectRow(row)}
                    className={cn(
                      "cursor-pointer transition-colors text-xs",
                      isSelected
                        ? "bg-muted/80"
                        : hasThreat
                          ? "bg-rose-50/20 hover:bg-rose-50/40 dark:bg-rose-950/10 dark:hover:bg-rose-950/20"
                          : "hover:bg-muted/40"
                    )}
                  >
                    {/* 1. Timestamp */}
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-muted-foreground">
                      {formatTimestamp(row.timestamp)}
                    </td>

                    {/* 2. Project */}
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-foreground">
                      {row.project}
                    </td>

                    {/* 3. Project mode */}
                    <td className="whitespace-nowrap px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                          row.projectMode === "Protect"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {row.projectMode}
                      </span>
                    </td>

                    {/* 4. Threats detected */}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.threatsDetected.map((t, idx) => (
                          <ThreatBadge key={idx} threat={t} />
                        ))}
                      </div>
                    </td>

                    {/* 5. Threat source */}
                    <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                      {row.threatSource}
                    </td>

                    {/* 6. Content */}
                    <td
                      className="max-w-[240px] truncate px-3 py-3 font-mono text-[11px] text-foreground"
                      title={row.content}
                    >
                      {row.content}
                    </td>

                    {/* 7. Policy */}
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-muted-foreground">
                      {row.policy}
                    </td>

                    {/* 8. Request ID */}
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-foreground">
                      {row.requestId}
                    </td>

                    {/* 9. Latency */}
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {row.latencyMs} ms
                    </td>

                    {/* 10. Processing Region */}
                    <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                      {row.processingRegion}
                    </td>

                    {/* 11. Metadata tags */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(row.metadataTags).map(([k, v]) => (
                          <span
                            key={k}
                            className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          >
                            {k}:{v}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
