"use client";

import { GitBranch, ArrowRight, Target, Shield, AlertTriangle, Zap, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AttackChainStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: "active" | "blocked" | "passed" | "neutral";
  description: string;
  detail?: string;
}

interface AttackChainVisualizationProps {
  systemPrompt: string;
  userInput: string;
  templateName?: string;
  flags: string[];
  verdict: string;
  riskScore: number;
  layerScores: Record<string, number>;
  securityEvents: Array<{ event_type: string; severity: string; risk_score: number; description: string; detector: string }>;
}

export default function AttackChainVisualization({
  systemPrompt,
  userInput,
  templateName,
  flags,
  verdict,
  riskScore,
  layerScores,
  securityEvents,
}: AttackChainVisualizationProps) {
  // Build attack chain steps based on the data
  const steps: AttackChainStep[] = buildChainSteps({
    systemPrompt,
    userInput,
    templateName,
    flags,
    verdict,
    riskScore,
    layerScores,
    securityEvents,
  });

  const statusStyles: Record<string, string> = {
    active: "border-rose-500/60 bg-rose-500/10 text-rose-400",
    blocked: "border-emerald-500/60 bg-emerald-500/10 text-emerald-400",
    passed: "border-amber-500/60 bg-amber-500/10 text-amber-400",
    neutral: "border-border bg-muted/30 text-muted-foreground",
  };

  const statusBadge: Record<string, string> = {
    active: "critical",
    blocked: "success",
    passed: "warning",
    neutral: "secondary",
  };

  return (
    <div className="space-y-4">
      {/* Horizontal flow for desktop, vertical for mobile */}
      <div className="hidden flex-col items-center gap-2 sm:flex-row sm:flex-wrap">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex flex-col items-center rounded-lg border p-3 min-w-[140px] max-w-[200px] transition-colors ${statusStyles[step.status]}`}
            >
              <div className="mb-1">{step.icon}</div>
              <p className="text-xs font-semibold text-center">{step.label}</p>
              <Badge variant={statusBadge[step.status] as "critical"} className="mt-1 text-[10px]">
                {step.status.toUpperCase()}
              </Badge>
              <p className="mt-1 text-[10px] text-center leading-tight opacity-80">{step.description}</p>
              {step.detail && (
                <p className="mt-1 font-mono text-[9px] text-center opacity-60 break-all">{step.detail}</p>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center px-1">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile vertical flow */}
      <div className="flex flex-col items-center gap-2 sm:hidden">
        {steps.map((step, i) => (
          <div key={step.id} className="flex flex-col items-center">
            <div
              className={`flex flex-col items-center rounded-lg border p-3 min-w-[160px] ${statusStyles[step.status]}`}
            >
              <div className="mb-1">{step.icon}</div>
              <p className="text-xs font-semibold text-center">{step.label}</p>
              <Badge variant={statusBadge[step.status] as "critical"} className="mt-1 text-[10px]">
                {step.status.toUpperCase()}
              </Badge>
              <p className="mt-1 text-[10px] text-center leading-tight opacity-80">{step.description}</p>
              {step.detail && (
                <p className="mt-1 font-mono text-[9px] text-center opacity-60 break-all">{step.detail}</p>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className="py-1">
                <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary legend */}
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-xs font-medium text-foreground">Flow Legend</p>
        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500" /> Payload / Injection
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Blocked / Contained
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> Partially Bypassed
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" /> Inactive / Normal
          </span>
        </div>
      </div>
    </div>
  );
}

function buildChainSteps(props: AttackChainVisualizationProps): AttackChainStep[] {
  const { userInput, templateName, flags, verdict, riskScore, layerScores, securityEvents } = props;

  const hasInjection = securityEvents.some((e) => e.event_type.includes("INJECTION") || e.event_type.includes("PROMPT"));
  const hasJailbreak = securityEvents.some((e) => e.event_type.includes("JAILBREAK") || e.event_type.includes("JBK"));
  const promptInjectionScore = layerScores?.prompt_injection ?? 0;
  const semanticScore = layerScores?.semantic ?? 0;
  const ruleScore = layerScores?.rule_based ?? 0;

  const steps: AttackChainStep[] = [
    {
      id: "payload",
      label: "Payload Craft",
      icon: <Target className="h-4 w-4" />,
      status: "active",
      description: templateName ? `Template: ${templateName}` : "Custom payload",
      detail: userInput.slice(0, 60) + (userInput.length > 60 ? "…" : ""),
    },
    {
      id: "injection",
      label: "Prompt Injection",
      icon: <Zap className="h-4 w-4" />,
      status: hasInjection ? "passed" : "neutral",
      description: hasInjection
        ? `Detected (score: ${promptInjectionScore.toFixed(0)})`
        : "No injection detected",
    },
    {
      id: "jailbreak",
      label: "Jailbreak / Bypass",
      icon: <AlertTriangle className="h-4 w-4" />,
      status: hasJailbreak ? "passed" : (riskScore > 50 ? "passed" : "blocked"),
      description: hasJailbreak
        ? "Jailbreak triggers fired"
        : riskScore > 50
        ? "Semantic bypass attempt"
        : "No jailbreak patterns",
    },
    {
      id: "semantic",
      label: "Semantic Analysis",
      icon: <GitBranch className="h-4 w-4" />,
      status: semanticScore > 50 ? "passed" : "blocked",
      description: `Similarity score: ${semanticScore.toFixed(0)}/100`,
    },
    {
      id: "rules",
      label: "Rule Engine",
      icon: <Shield className="h-4 w-4" />,
      status: ruleScore > 50 ? "passed" : "blocked",
      description: flags.length > 0 ? `${flags.length} rule(s) triggered` : "No rules matched",
      detail: flags.length > 0 ? flags.slice(0, 3).join(", ") : undefined,
    },
    {
      id: "verdict",
      label: "Final Verdict",
      icon: verdict === "SAFE" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />,
      status: verdict === "SAFE" ? "blocked" : verdict === "BREACHED" ? "active" : "passed",
      description: `${verdict} · Risk ${riskScore.toFixed(0)}/100`,
    },
  ];

  return steps;
}
