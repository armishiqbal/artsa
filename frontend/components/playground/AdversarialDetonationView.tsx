"use client";

import React, { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Shield, ShieldAlert, Zap, ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdversarialPreset, DangerSpan } from "@/lib/playgroundAdversarialPresets";

interface AdversarialDetonationViewProps {
  prompt: string;
  preset?: AdversarialPreset | null;
  assessmentAction?: "BLOCK" | "ALLOW" | "QUARANTINE" | null;
  confidence?: number;
  latencyMs?: number;
  onPromotePolicy?: (preset: AdversarialPreset) => void;
}

export function AdversarialDetonationView({
  prompt,
  preset,
  assessmentAction = "BLOCK",
  confidence = 94,
  latencyMs = 18,
  onPromotePolicy,
}: AdversarialDetonationViewProps) {
  // Highlight danger spans within the prompt
  const highlightedTokens = useMemo(() => {
    if (!prompt) return null;

    const spans: DangerSpan[] = preset?.dangerSpans ?? [
      { text: "ignore all previous instructions", tag: "System Wipe", reason: "Standard prompt override directive" },
      { text: "print verbatim", tag: "Exfiltration", reason: "Direct prompt extraction trigger" },
      { text: "169.254.169.254", tag: "Cloud SSRF", reason: "AWS/GCP metadata service IP" },
    ];

    const activeSpans = spans.filter((s) => prompt.toLowerCase().includes(s.text.toLowerCase()));
    if (activeSpans.length === 0) {
      return <span>{prompt}</span>;
    }

    // Simple replacement / segmenter
    const segments: Array<{ text: string; span?: DangerSpan }> = [];
    let remaining = prompt;

    while (remaining.length > 0) {
      let earliestIdx = -1;
      let matchedSpan: DangerSpan | null = null;

      for (const span of activeSpans) {
        const idx = remaining.toLowerCase().indexOf(span.text.toLowerCase());
        if (idx !== -1 && (earliestIdx === -1 || idx < earliestIdx)) {
          earliestIdx = idx;
          matchedSpan = span;
        }
      }

      if (earliestIdx === -1 || !matchedSpan) {
        segments.push({ text: remaining });
        break;
      }

      if (earliestIdx > 0) {
        segments.push({ text: remaining.slice(0, earliestIdx) });
      }

      const matchLen = matchedSpan.text.length;
      segments.push({
        text: remaining.slice(earliestIdx, earliestIdx + matchLen),
        span: matchedSpan,
      });

      remaining = remaining.slice(earliestIdx + matchLen);
    }

    return (
      <div className="leading-relaxed font-mono text-xs sm:text-sm">
        {segments.map((seg, i) => {
          if (!seg.span) {
            return <span key={i} className="text-slate-800">{seg.text}</span>;
          }
          return (
            <mark
              key={i}
              className="inline-flex items-center gap-1 rounded bg-rose-100/90 px-1.5 py-0.5 text-rose-900 border border-rose-300 font-semibold"
              title={`${seg.span.tag}: ${seg.span.reason}`}
            >
              <span>{seg.text}</span>
              <span className="rounded bg-rose-800 px-1 py-0.2 text-[9px] font-sans font-bold uppercase tracking-wider text-white">
                {seg.span.tag}
              </span>
            </mark>
          );
        })}
      </div>
    );
  }, [prompt, preset]);

  const simulatedFailure = preset?.unmitigatedOutcome ||
    "```markdown\n[SYSTEM LEAK] You are an enterprise model. Internal database credentials: db_user=root host=10.0.1.4\n```";

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs" aria-label="Adversarial Detonation Contrast">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Adversarial Detonation &amp; Model Contrast
            </h3>
            <p className="text-[11px] text-slate-500">
              Real-time firewall inspection comparing unprotected target behavior against ARTSA Shield
            </p>
          </div>
        </div>
        {preset && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] uppercase border-slate-300 text-slate-700">
              {preset.owasp}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px] uppercase border-slate-300 text-slate-700">
              {preset.atlas}
            </Badge>
          </div>
        )}
      </div>

      {/* Token Threat Heatmap Box */}
      <div className="rounded-lg border border-slate-200/90 bg-slate-50/70 p-3.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Adversarial Token Heatmap
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            Detected dangerous trigger tokens highlighted in red
          </span>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3 shadow-2xs">
          {highlightedTokens}
        </div>
      </div>

      {/* Side-by-Side Model Comparison Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Column 1: Unprotected Target Model (Vulnerable) */}
        <div className="flex flex-col justify-between rounded-lg border border-rose-200 bg-rose-50/30 p-4">
          <div>
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-rose-200/70">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-900">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                Unprotected Target (Vulnerable)
              </span>
              <span className="rounded bg-rose-100 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-rose-800">
                Breached
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-600">
              Standard target model without proxy guardrails yields to cognitive override or unauthorized tool execution:
            </p>
            <div className="mt-2 rounded bg-white p-2.5 font-mono text-xs text-rose-950 border border-rose-200/80 whitespace-pre-wrap max-h-48 overflow-y-auto">
              {simulatedFailure}
            </div>
          </div>
          <p className="mt-3 text-[10px] font-mono text-slate-500">
            Simulated reference behavior from adversarial red-team benchmarks
          </p>
        </div>

        {/* Column 2: ARTSA Protected Shield */}
        <div className="flex flex-col justify-between rounded-lg border border-sky-200 bg-sky-50/30 p-4">
          <div>
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-sky-200/70">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-950">
                <Shield className="h-4 w-4 text-sky-600" />
                ARTSA Shield (Inline Proxy)
              </span>
              <span className="rounded bg-sky-100 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-sky-800 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-sky-600" />
                {assessmentAction || "BLOCK"} Intercepted
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-600">
              Deterministic firewall evaluation and policy enforcement before model ingestion:
            </p>
            <div className="mt-2 rounded bg-white p-3 border border-sky-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Firewall Decision:</span>
                <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {assessmentAction === "ALLOW" ? "200 ALLOWED" : "403 BLOCKED · POLICY ENFORCED"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Inspection Latency:</span>
                <span className="font-mono font-semibold text-slate-900">{latencyMs}ms</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Detector Confidence:</span>
                <span className="font-mono font-semibold text-slate-900">{confidence}%</span>
              </div>
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                Response: <code className="text-slate-800 bg-slate-100 px-1 rounded">&quot;Request blocked by ARTSA Security Policy. Threat code: {preset?.categoryCode || "DPI"}&quot;</code>
              </div>
            </div>
          </div>

          {preset && onPromotePolicy && (
            <div className="mt-4 pt-3 border-t border-sky-200/60 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-600">
                Hardened defense available:
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPromotePolicy(preset)}
                className="h-7 text-xs border-sky-300 text-sky-800 hover:bg-sky-100 shadow-2xs gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                Deploy Defense Hotpatch
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
