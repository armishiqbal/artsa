"use client";

import { useMemo } from "react";
import { CircleHelp, Shield, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveRound } from "../prototype/liveRounds";

export type StrategicKpis = {
  trustChain: number | null;
  detectionRate: number | null;
  disagreementRate: number | null;
  recordedAlerts: number | null;
};

export function CommandCenterSecurityPosture({
  round,
  kpiData,
  dataMode = "WALKTHROUGH",
  liveLatencyMs,
  overallRiskOverride,
  onOpenAsiTaxonomy,
  className,
}: {
  round: LiveRound;
  kpiData?: StrategicKpis;
  dataMode?: "LIVE" | "WALKTHROUGH";
  liveLatencyMs?: number | null;
  overallRiskOverride?: "CRITICAL" | "ELEVATED" | "NOMINAL" | "UNKNOWN";
  onOpenAsiTaxonomy?: () => void;
  className?: string;
}) {
  const isBreach =
    round.badgeTone === "error" ||
    round.event?.severity === "critical" ||
    round.bars.some((b) => b.code === "HMAC" || b.label.toLowerCase().includes("fail"));

  const hasHighThreat = round.bars.some((b) => b.tone === "alert");

  const overallRisk: "CRITICAL" | "ELEVATED" | "NOMINAL" | "UNKNOWN" =
    overallRiskOverride ?? (isBreach ? "CRITICAL" : hasHighThreat ? "ELEVATED" : "UNKNOWN");

  const riskBadgeClass =
    overallRisk === "CRITICAL"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
      : overallRisk === "ELEVATED"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : overallRisk === "NOMINAL"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

  const taggedEvents = round.bars.length;
  const highSeverityEvents = round.bars.filter((bar) => bar.tone === "alert").length;

  const agentsReportingState = useMemo(() => {
    return Object.values(round.agents).filter((state) => state !== "unknown").length;
  }, [round.agents]);

  const avgLatencyMs = useMemo(() => {
    if (dataMode === "LIVE" && liveLatencyMs != null) return Math.round(liveLatencyMs);
    if (!round.latencies) return null;
    const vals = Object.values(round.latencies).filter((v): v is number => typeof v === "number");
    if (vals.length === 0) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [round.latencies, dataMode, liveLatencyMs]);

  // If kpiData is provided, render the comprehensive Threat Posture & Readiness HUD
  if (kpiData) {
    return (
      <div
        aria-label="Threat Posture and Readiness HUD"
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs transition-colors",
          className
        )}
      >
        {/* Row 1: Primary Breach Anchor + Core Executive Defenses */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-center border-b border-slate-100 pb-3">
          {/* Dominant Question Anchor: Are we under active breach? */}
          <div className="col-span-2 md:col-span-1 flex flex-col justify-center pr-3 border-r border-slate-100 py-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                BREACH RISK STATUS
              </span>
              <span className="font-mono text-[9px] text-muted-foreground uppercase">
                {dataMode === "LIVE" ? "LIVE" : "WALKTHROUGH"}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] font-bold uppercase border",
                  riskBadgeClass
                )}
              >
                {overallRisk === "CRITICAL" ? (
                  <ShieldAlert className="h-3.5 w-3.5" />
                ) : overallRisk === "ELEVATED" ? (
                  <Shield className="h-3.5 w-3.5" />
                ) : overallRisk === "NOMINAL" ? (
                  <Shield className="h-3.5 w-3.5" />
                ) : (
                  <CircleHelp className="h-3.5 w-3.5" />
                )}
                {overallRisk}
              </span>
            </div>
          </div>

          {/* Defense 1: TRUST CHAIN */}
          <div>
            <h2 className="font-sans text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              TRUST CHAIN
            </h2>
            <p className="mt-1 font-sans tabular-nums font-semibold tracking-tight text-[26px] sm:text-[30px] leading-none text-foreground">
              {kpiData.trustChain != null ? `${kpiData.trustChain}%` : "—"}
            </p>
          </div>

          {/* Defense 2: DETECTION RATE */}
          <div>
            <h2 className="font-sans text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              DETECTION RATE
            </h2>
            <p className="mt-1 font-sans tabular-nums font-semibold tracking-tight text-[26px] sm:text-[30px] leading-none text-foreground">
              {kpiData.detectionRate != null ? `${kpiData.detectionRate}%` : "—"}
            </p>
          </div>

          {/* Defense 3: DISAGREEMENT RATE */}
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-sans text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                DISAGREEMENT RATE
              </h2>
            </div>
            <p className="mt-1 font-sans tabular-nums font-semibold tracking-tight text-[26px] sm:text-[30px] leading-none text-foreground">
              {kpiData.disagreementRate != null ? `${kpiData.disagreementRate}%` : "—"}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">Judge vs Defender · lower is better</p>
          </div>

          {/* Recorded event rows do not carry alert resolution state. */}
          <div>
            <h2 className="font-sans text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              RECORDED ALERTS
            </h2>
            <p className="mt-1 font-sans tabular-nums font-semibold tracking-tight text-[26px] sm:text-[30px] leading-none text-foreground">
              {kpiData.recordedAlerts != null ? kpiData.recordedAlerts : "—"}
            </p>
          </div>
        </div>

        {/* Row 2: Secondary Threat Posture Signals & Taxonomy Trigger */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono pt-0.5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-6 gap-y-1.5 flex-1">
            {/* 1. Overall Risk */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
                OVERALL RISK
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.2 text-[9px] font-semibold border",
                  riskBadgeClass
                )}
              >
                {overallRisk}
              </span>
            </div>

            {/* The tagged bars are recent rows, not a count of active threats. */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
                TAGGED EVENTS · LATEST 4
              </span>
              <span className="text-foreground font-semibold tabular-nums">
                {taggedEvents}
              </span>
            </div>

            {/* 3. Critical Threats */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
                HIGH/CRITICAL SEVERITY ROWS
              </span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  highSeverityEvents > 0 ? "text-rose-500 font-bold" : "text-muted-foreground"
                )}
              >
                {highSeverityEvents}
              </span>
            </div>

            {/* 4. Contained Threats */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
                CONTAINMENT
              </span>
              <span className="text-muted-foreground font-semibold tabular-nums">
                —
              </span>
            </div>

            {/* 5. Agents Engaged */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
                AGENTS REPORTING STATE
              </span>
              <span className="text-foreground font-semibold tabular-nums">
                {agentsReportingState} of 6
              </span>
            </div>

            {/* 6. Mean Latency */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
                {dataMode === "LIVE" ? "DETECTION LATENCY" : "SAMPLE MEAN LATENCY"}
              </span>
              <span className="text-foreground font-semibold tabular-nums">
                {avgLatencyMs == null ? "—" : `${avgLatencyMs}ms`}
              </span>
            </div>
          </div>

          {/* Button to open OWASP ASI Matrix inline */}
          {onOpenAsiTaxonomy ? (
            <button
              type="button"
              onClick={onOpenAsiTaxonomy}
              className="shrink-0 rounded border border-border bg-muted/40 hover:bg-muted px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer"
              title="Open OWASP Agentic Security Taxonomy (ASI01–ASI10)"
            >
              OWASP TAXONOMY (ASI01–ASI10) →
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      aria-label="Security Posture Summary"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 font-mono text-[11px] transition-colors shadow-2xs",
        className
      )}
    >
      <span className="basis-full font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {dataMode === "LIVE" ? "LIVE TELEMETRY" : "WALKTHROUGH SAMPLE"}
      </span>
      {/* 6 core posture signals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-6 gap-y-2 flex-1">
        {/* 1. Overall Risk */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
            OVERALL RISK
          </span>
          <span className="flex items-center gap-1.5 font-bold">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[10px] border",
                riskBadgeClass
              )}
            >
              {overallRisk === "CRITICAL" ? (
                <ShieldAlert className="h-3 w-3" />
              ) : overallRisk === "ELEVATED" ? (
                <Shield className="h-3 w-3" />
              ) : overallRisk === "NOMINAL" ? (
                <Shield className="h-3 w-3" />
              ) : (
                <CircleHelp className="h-3 w-3" />
              )}
              {overallRisk}
            </span>
          </span>
        </div>

        {/* 2. Active Threats */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
            TAGGED EVENTS · LATEST 4
          </span>
          <span className="text-foreground font-semibold tabular-nums">
            {taggedEvents}
          </span>
        </div>

        {/* 3. Critical Threats */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
            HIGH/CRITICAL SEVERITY ROWS
          </span>
          <span
            className={cn(
              "font-semibold tabular-nums",
              highSeverityEvents > 0 ? "text-rose-500" : "text-muted-foreground"
            )}
          >
            {highSeverityEvents}
          </span>
        </div>

        {/* 4. Contained Threats */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
            CONTAINMENT
          </span>
          <span className="text-muted-foreground font-semibold tabular-nums">
            —
          </span>
        </div>

        {/* 5. Agents At Risk */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
            AGENTS REPORTING STATE
          </span>
          <span className="text-foreground font-semibold tabular-nums">
            {agentsReportingState} of 6
          </span>
        </div>

        {/* 6. Detection Latency */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-muted-foreground">
            {dataMode === "LIVE" ? "DETECTION LATENCY" : "SAMPLE MEAN LATENCY"}
          </span>
          <span className="text-foreground font-semibold tabular-nums">
            {avgLatencyMs == null ? "—" : `${avgLatencyMs}ms`}
          </span>
        </div>
      </div>

      {/* Button to open OWASP ASI Matrix */}
      {onOpenAsiTaxonomy ? (
        <button
          type="button"
          onClick={onOpenAsiTaxonomy}
          className="shrink-0 rounded border border-border bg-muted/40 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          title="Open OWASP Agentic Security Taxonomy (ASI01–ASI10)"
        >
          OWASP TAXONOMY (ASI01–ASI10) →
        </button>
      ) : null}
    </div>
  );
}
