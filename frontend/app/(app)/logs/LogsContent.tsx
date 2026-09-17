"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LogsHeader } from "@/components/logs/LogsHeader";
import { LogsFilterBar } from "@/components/logs/LogsFilterBar";
import { LogsTable } from "@/components/logs/LogsTable";
import { LogDetailDrawer } from "@/components/logs/LogDetailDrawer";
import { FloatingAssistantWidget } from "@/components/logs/FloatingAssistantWidget";
import { useDashboardMetrics } from "@/lib/hooks/useDashboardMetrics";
import { useConnection } from "@/lib/context/ConnectionProvider";
import {
  INITIAL_LOGS_FILTERS,
  telemetryToLogRecord,
  type LogRecord,
  type LogsFilterState,
} from "@/lib/logsTypes";
import { toast } from "@/lib/stores/toast";

export default function LogsContent() {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session")?.trim() ?? "";
  const threatParam = searchParams.get("threats")?.trim() ?? "";
  const projectParam = searchParams.get("project")?.trim() ?? "";

  const { liveEvents, loading, pullTelemetryRecent } = useDashboardMetrics();
  const { apiOnline } = useConnection();

  const [filters, setFilters] = useState<LogsFilterState>(() => ({
    ...INITIAL_LOGS_FILTERS,
    project: projectParam || "all",
    toggle: threatParam === "true" ? "threats" : "all",
  }));

  useEffect(() => {
    if (projectParam) {
      setFilters((prev) => ({ ...prev, project: projectParam }));
    }
  }, [projectParam]);

  const [selectedRow, setSelectedRow] = useState<LogRecord | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Poll telemetry when online
  useEffect(() => {
    if (!apiOnline) return;
    void pullTelemetryRecent(true);
  }, [apiOnline, pullTelemetryRecent]);

  // Real live telemetry events only (no fake hardcoded sample records)
  const allRecords = useMemo(() => {
    return (liveEvents ?? []).map((evt, idx) => telemetryToLogRecord(evt, idx));
  }, [liveEvents]);

  // Filter & sort rows
  const filteredRows = useMemo(() => {
    return allRecords
      .filter((row) => {
        // Project filter
        if (filters.project === "none") {
          if (row.project !== "No project" && row.project !== "") return false;
        } else if (filters.project !== "all") {
          if (row.project.toLowerCase() !== filters.project.toLowerCase()) return false;
        }

        // Toggle: Threats vs All
        if (filters.toggle === "threats") {
          const hasThreat = row.threatsDetected.some((t) => t !== "No detections");
          if (!hasThreat) return false;
        }

        // Detection result filter
        if (filters.detectionResults.length > 0) {
          const matchesDetection = row.threatsDetected.some((t) =>
            filters.detectionResults.includes(t)
          );
          if (!matchesDetection) return false;
        }

        // Region filter
        if (filters.regions.length > 0) {
          if (!filters.regions.includes(row.processingRegion)) return false;
        }

        // Model filter
        if (filters.models.length > 0) {
          const rowModel = row.metadataTags.model;
          if (!rowModel || !filters.models.includes(rowModel)) return false;
        }

        // Application filter
        if (filters.applications.length > 0) {
          const rowApp = row.metadataTags.application;
          if (!rowApp || !filters.applications.includes(rowApp)) return false;
        }

        // Project metadata filter
        if (filters.projectMetadata.length > 0) {
          const hasMeta = filters.projectMetadata.some((m) => {
            const [k, v] = m.split(":");
            return row.metadataTags[k] === v;
          });
          if (!hasMeta) return false;
        }

        // Request metadata filter
        if (filters.requestMetadata.length > 0) {
          const matchMeta = filters.requestMetadata.some((rm) => {
            if (rm.includes("high-latency")) return row.latencyMs > 100;
            return false;
          });
          if (!matchMeta) return false;
        }

        // Request ID search
        if (filters.requestIds) {
          const q = filters.requestIds.toLowerCase().trim();
          if (!row.requestId.toLowerCase().includes(q) && !row.id.toLowerCase().includes(q)) {
            return false;
          }
        }

        // Date range filter
        if (filters.dateRange !== "all") {
          const rowTime = new Date(row.timestamp).getTime();
          const now = Date.now();
          if (!isNaN(rowTime)) {
            if (filters.dateRange === "today") {
              const startOfToday = new Date();
              startOfToday.setHours(0, 0, 0, 0);
              if (rowTime < startOfToday.getTime()) return false;
            } else if (filters.dateRange === "yesterday") {
              const startOfYesterday = new Date();
              startOfYesterday.setDate(startOfYesterday.getDate() - 1);
              startOfYesterday.setHours(0, 0, 0, 0);
              const endOfYesterday = new Date();
              endOfYesterday.setDate(endOfYesterday.getDate() - 1);
              endOfYesterday.setHours(23, 59, 59, 999);
              if (rowTime < startOfYesterday.getTime() || rowTime > endOfYesterday.getTime()) return false;
            } else if (filters.dateRange === "24h") {
              if (rowTime < now - 24 * 3600 * 1000) return false;
            } else if (filters.dateRange === "7d") {
              if (rowTime < now - 7 * 24 * 3600 * 1000) return false;
            } else if (filters.dateRange === "30d") {
              if (rowTime < now - 30 * 24 * 3600 * 1000) return false;
            }
          }
        }

        // Session ID search param support
        if (sessionParam) {
          const rawSess = String(row.rawEvent?.session_id ?? "");
          if (!rawSess.includes(sessionParam)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sortField === "latency") {
          return filters.sortOrder === "asc"
            ? a.latencyMs - b.latencyMs
            : b.latencyMs - a.latencyMs;
        }
        const timeA = new Date(a.timestamp).getTime() || 0;
        const timeB = new Date(b.timestamp).getTime() || 0;
        return filters.sortOrder === "asc" ? timeA - timeB : timeB - timeA;
      });
  }, [allRecords, filters, sessionParam]);

  const handleUpdateData = useCallback(async () => {
    setIsUpdating(true);
    try {
      await pullTelemetryRecent(true);
      toast("Logs updated", {
        description: "Fetched latest containment telemetry",
        variant: "success",
      });
    } catch {
      toast("Update failed", { variant: "error" });
    } finally {
      setTimeout(() => setIsUpdating(false), 400);
    }
  }, [pullTelemetryRecent]);

  const handleExport = useCallback(
    (format: "csv" | "json" | "ndjson") => {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

      if (format === "csv") {
        const headers = [
          "timestamp",
          "project",
          "project_mode",
          "threats_detected",
          "threat_source",
          "content",
          "policy",
          "request_id",
          "latency_ms",
          "processing_region",
        ];
        const lines = [
          headers.join(","),
          ...filteredRows.map((r) =>
            [
              JSON.stringify(r.timestamp),
              JSON.stringify(r.project),
              JSON.stringify(r.projectMode),
              JSON.stringify(r.threatsDetected.join(";")),
              JSON.stringify(r.threatSource),
              JSON.stringify(r.content),
              JSON.stringify(r.policy),
              JSON.stringify(r.requestId),
              r.latencyMs,
              JSON.stringify(r.processingRegion),
            ].join(",")
          ),
        ];
        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `artsa-logs-${stamp}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "ndjson") {
        const lines = filteredRows.map((r) => JSON.stringify(r));
        const blob = new Blob([lines.join("\n")], {
          type: "application/x-ndjson;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `artsa-logs-${stamp}.ndjson`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const json = JSON.stringify(filteredRows, null, 2);
        const blob = new Blob([json], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `artsa-logs-${stamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast(`Exported ${filteredRows.length} log records`, { variant: "success" });
    },
    [filteredRows]
  );

  const handleToggleSort = (field: "timestamp" | "latency") => {
    if (filters.sortField === field) {
      setFilters({
        ...filters,
        sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
      });
    } else {
      setFilters({
        ...filters,
        sortField: field,
        sortOrder: "desc",
      });
    }
  };

  const handleClearFilters = () => {
    setFilters({ ...INITIAL_LOGS_FILTERS });
    toast("Filters reset", { variant: "default" });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-4">
      {/* 1. Page Header matching screenshot */}
      <LogsHeader
        toggle={filters.toggle}
        onToggleChange={(val) => setFilters({ ...filters, toggle: val })}
        onUpdateData={handleUpdateData}
        onExport={handleExport}
        isUpdating={isUpdating}
      />

      {/* 2. Filter Bar matching screenshot (All projects, Filters, Today) */}
      <LogsFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={handleClearFilters}
      />

      {/* 3. 11-Column Security Logs Table */}
      <LogsTable
        rows={filteredRows}
        selectedId={selectedRow?.id ?? null}
        onSelectRow={setSelectedRow}
        onClearFilters={handleClearFilters}
        sortField={filters.sortField}
        sortOrder={filters.sortOrder}
        onToggleSort={handleToggleSort}
        loading={loading}
      />

      {/* 4. Inspection Drawer for selected row */}
      <LogDetailDrawer
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
      />

      {/* 5. Floating Assistant launcher widget matching screenshot */}
      <FloatingAssistantWidget />
    </div>
  );
}
