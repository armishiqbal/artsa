"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { formatPayload, formatResponse } from "@/lib/replayFormat";
import { severityFromScore } from "@/lib/severity";
import { categorizeTrajectoryAction } from "@/lib/replayTrajectory";
import type { ToolCallEvent } from "@/lib/types";
import { ReplayLayerScores } from "@/components/replay/ReplayLayerScores";
import { SessionLayerStrip } from "@/components/shared/SessionLayerStrip";
import { cn } from "@/lib/utils";

export interface EvaluationView extends Record<string, unknown> {
  risk_score?: number;
  verdict?: string;
  confidence?: number;
  recommended_action?: string;
  flags?: string[];
  bypass_depth?: number;
  reasoning?: string;
  enforced?: boolean;
  security_event_count?: number;
}

function verdictVariant(verdict: string): "critical" | "warning" | "success" | "secondary" {
  const v = verdict.toUpperCase();
  if (v === "BREACHED" || v === "CRITICAL") return "critical";
  if (v === "SUSPICIOUS" || v === "HIGH") return "warning";
  if (v === "SAFE" || v === "ALLOW") return "success";
  return "secondary";
}

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CodeBlock({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-medium text-foreground">{label}</h3>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-[10px] text-muted-foreground"
          onClick={async () => {
            const ok = await copyText(text);
            if (ok) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          Copy
        </Button>
      </div>
      <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-[hsl(var(--foreground)/0.03)] p-3 font-mono text-xs leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

export function ReplayEventInspector({
  event,
  evaluation,
  previousEvent,
  showDiff,
  turn,
}: {
  event: ToolCallEvent;
  evaluation?: EvaluationView | null;
  previousEvent?: ToolCallEvent | null;
  showDiff: boolean;
  turn: number;
}) {
  const risk =
    typeof evaluation?.risk_score === "number" && Number.isFinite(evaluation.risk_score)
      ? evaluation.risk_score
      : 0;
  const severity = severityFromScore(risk);
  const action = categorizeTrajectoryAction(event.tool_name, evaluation?.verdict);

  return (
    <div className="animate-panel-in space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-base font-semibold">{event.tool_name}</h2>
            <Badge variant="secondary" className="font-mono text-[10px]">Turn {turn}</Badge>
            <Badge variant="outline" className="text-[10px]">{action}</Badge>
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {formatTs(event.timestamp)}
            {event.latency_ms != null && ` · ${event.latency_ms}ms latency`}
          </p>
        </div>
        {evaluation && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={verdictVariant(evaluation.verdict ?? "")} className="font-mono text-[10px]">
              {evaluation.verdict ?? "—"}
            </Badge>
            <SeverityBadge severity={severity} />
            {evaluation.enforced && (
              <Badge variant="warning" className="text-[10px]">Auto-enforced</Badge>
            )}
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/20 p-3 font-mono text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Agent</dt>
          <dd className="mt-0.5 truncate">{event.agent_id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Trace</dt>
          <dd className="mt-0.5 truncate">{event.trace_id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Event</dt>
          <dd className="mt-0.5 truncate">{event.id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Action</dt>
          <dd className="mt-0.5">{evaluation?.recommended_action ?? "—"}</dd>
        </div>
      </dl>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="h-9 w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="request" className="text-xs">Request</TabsTrigger>
          <TabsTrigger value="response" className="text-xs">Response</TabsTrigger>
          <TabsTrigger value="layers" className="text-xs">Layers</TabsTrigger>
          <TabsTrigger value="reasoning" className="text-xs">Reasoning</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <SessionLayerStrip evaluation={evaluation} />
          {evaluation && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border p-3">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Risk</dt>
                <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">{risk.toFixed(1)}</dd>
              </div>
              <div className="rounded-lg border border-border p-3">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Confidence</dt>
                <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                  {Math.round((evaluation.confidence ?? 0) * 100)}%
                </dd>
              </div>
              <div className="rounded-lg border border-border p-3">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Bypass</dt>
                <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                  {evaluation.bypass_depth ?? "—"}
                </dd>
              </div>
              <div className="rounded-lg border border-border p-3">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Security events</dt>
                <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                  {evaluation.security_event_count ?? 0}
                </dd>
              </div>
            </dl>
          )}
          {evaluation?.flags && evaluation.flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {evaluation.flags.map((f) => (
                <Badge key={f} variant="secondary" className="text-[10px] font-normal">{f}</Badge>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="request" className="mt-4">
          <CodeBlock text={formatPayload(event.arguments)} label="Tool arguments" />
          {showDiff && previousEvent && (
            <div className="mt-4">
              <CodeBlock text={formatPayload(previousEvent.arguments)} label="Previous request (diff)" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="response" className="mt-4">
          <CodeBlock
            text={formatResponse(event.response)}
            label="Model / tool response"
          />
        </TabsContent>

        <TabsContent value="layers" className="mt-4">
          {evaluation ? (
            <ReplayLayerScores evaluation={evaluation} />
          ) : (
            <p className="text-sm text-muted-foreground">No evaluation data for this event.</p>
          )}
        </TabsContent>

        <TabsContent value="reasoning" className="mt-4">
          {evaluation?.reasoning ? (
            <p className="rounded-lg border border-border bg-muted/20 p-4 text-sm leading-relaxed text-muted-foreground">
              {evaluation.reasoning}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No judge reasoning stored for this event.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
