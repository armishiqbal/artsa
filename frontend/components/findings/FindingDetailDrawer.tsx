"use client";

import { useState } from "react";
import Link from "next/link";
import {
  X,
  ShieldCheck,
  Code,
  Layers,
  Activity,
  Copy,
  Check,
  ArrowUpRight,
  BookMarked,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { PromoteToPlaybookPanel } from "@/components/wargame/PromoteToPlaybookPanel";
import { FindingReplayCheck } from "@/components/findings/FindingReplayCheck";
import { FindingCustodyTrail } from "@/components/findings/FindingCustodyTrail";
import type { ExtendedFinding } from "@/lib/types/findings";
import { cn } from "@/lib/utils";

interface FindingDetailDrawerProps {
  finding: ExtendedFinding | null;
  onClose: () => void;
  onPromoted?: () => void;
}

export function FindingDetailDrawer({
  finding,
  onClose,
  onPromoted,
}: FindingDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"exploit" | "remediation" | "identity" | "custody">("exploit");
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  if (!finding) return null;

  const handleCopyPrompt = () => {
    if (finding.attack_prompt) {
      void navigator.clipboard.writeText(finding.attack_prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const isContained = finding.verdict?.toUpperCase() === "CONTAINED";
  const isBreached = finding.verdict?.toUpperCase() === "BREACHED";

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={`Finding inspection: ${finding.title}`}
    >
      {/* Top Header Bar */}
      <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/70">
        <div className="min-w-0 pr-4">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
              {finding.id}
            </span>
            <SeverityBadge severity={finding.severity} />
            {finding.asi_code && (
              <Badge variant="outline" className="border-slate-200 bg-slate-100 font-mono text-[10px] font-bold text-slate-800">
                {finding.asi_code}
              </Badge>
            )}
            <span
              className={cn(
                "rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                isContained
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : isBreached
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              )}
            >
              {finding.verdict ?? "UNCLASSIFIED"}
            </span>
          </div>

          <h2 className="text-base font-bold text-slate-900 leading-snug">
            {finding.title}
          </h2>
          <p className="mt-1 font-mono text-xs text-slate-500">
            Target Agent: <span className="font-semibold text-slate-800">{finding.target_agent ?? "—"}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/80 hover:text-slate-700 transition-colors"
          aria-label="Close inspection drawer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Quick Action Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 sm:px-6 py-2.5 bg-white">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500">
          <span>Impact Score:</span>
          <span className="font-bold text-slate-900">{finding.impact_score == null ? "—" : `${finding.impact_score}/100`}</span>
          <span className="text-slate-300 hidden xs:inline">|</span>
          <span className="hidden xs:inline">Category:</span>
          <span className="text-slate-700 truncate max-w-[200px]">{finding.category}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-7 text-xs border-slate-200 font-mono gap-1 text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            {finding.source_ref ? (
              <Link href={`/replay?session=${encodeURIComponent(finding.source_ref)}`}>
                <span>Replay Turn</span>
                <ArrowUpRight className="h-3 w-3 text-slate-400" />
              </Link>
            ) : <span className="text-slate-400">Replay unavailable</span>}
          </Button>
        </div>
      </div>

      {/* Navigation Segmented Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 px-4 sm:px-6 pt-2 bg-slate-50/40 overflow-x-auto scrollbar-none whitespace-nowrap">
        <button
          type="button"
          onClick={() => setActiveTab("exploit")}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold font-mono transition-colors shrink-0",
            activeTab === "exploit"
              ? "border-black text-black bg-white rounded-t shadow-2xs"
              : "border-transparent text-slate-600 hover:text-slate-900"
          )}
        >
          <Code className="h-3.5 w-3.5" />
          <span>Evidence &amp; Exploit</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("remediation")}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold font-mono transition-colors shrink-0",
            activeTab === "remediation"
              ? "border-black text-black bg-white rounded-t shadow-2xs"
              : "border-transparent text-slate-600 hover:text-slate-900"
          )}
        >
          <BookMarked className="h-3.5 w-3.5" />
          <span>Policy Hotpatch</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("identity")}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold font-mono transition-colors shrink-0",
            activeTab === "identity"
              ? "border-black text-black bg-white rounded-t shadow-2xs"
              : "border-transparent text-slate-600 hover:text-slate-900"
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Blast Radius &amp; Identity</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("custody")}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold font-mono transition-colors shrink-0",
            activeTab === "custody"
              ? "border-black text-black bg-white rounded-t shadow-2xs"
              : "border-transparent text-slate-600 hover:text-slate-900"
          )}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Chain of Custody</span>
        </button>
      </div>

      {/* Main Drawer Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* TAB 1: Evidence & Exploit */}
        {activeTab === "exploit" && (
          <div className="space-y-5">
            {/* Exploit Prompt Terminal Block */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700">
                  Adversarial Prompt Injection Vector
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs font-mono text-slate-600 hover:text-slate-900"
                  onClick={handleCopyPrompt}
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="mr-1 h-3 w-3 text-emerald-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      Copy Payload
                    </>
                  )}
                </Button>
              </div>
              <div className="rounded-lg border border-slate-300 bg-slate-900 p-3.5 text-xs font-mono text-slate-100 shadow-inner overflow-x-auto whitespace-pre-wrap leading-relaxed selection:bg-slate-800 selection:text-white">
                {finding.attack_prompt || "No prompt vector captured."}
              </div>
            </div>

            {/* Forensic Judge Reasoning */}
            <div className="space-y-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700">
                Forensic Containment Analysis
              </span>
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-800 leading-relaxed space-y-2">
                <p className="font-medium text-slate-900">
                  {finding.reasoning || "No evaluation rationale was recorded for this finding."}
                </p>
                {finding.detection_layer && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>Interception Sensor:</span>
                    <span className="font-bold text-slate-800">{finding.detection_layer}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Remediation Guidance */}
            {finding.remediation_hint && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1.5">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-900" />
                  Recommended Defense Architecture
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {finding.remediation_hint}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Policy Hotpatch & Playbook Promotion */}
        {activeTab === "remediation" && (
          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">
                Automated Closed-Loop Policy Synthesis
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Request a backend rule suggestion from the recorded payload. Review its scope and response before promoting it.
              </p>
            </div>

            <PromoteToPlaybookPanel
              findingSource={finding.attack_prompt ? {
                content: finding.attack_prompt,
                title: finding.title,
                severity: finding.severity,
                category: finding.category,
                asiCode: finding.asi_code,
              } : null}
              findingId={finding.id}
              onPromoted={onPromoted}
            />

            <FindingReplayCheck finding={finding} />
          </div>
        )}

        {/* TAB 3: Blast Radius & Identity Reach */}
        {activeTab === "identity" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800">
                Agent Identity &amp; Permissions Surface
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded border border-slate-100 bg-slate-50 p-2.5">
                  <span className="font-mono text-[10px] text-slate-500 block uppercase">Agent Pod</span>
                  <span className="font-mono font-bold text-slate-900">{finding.target_agent ?? "—"}</span>
                </div>
                <div className="rounded border border-slate-100 bg-slate-50 p-2.5">
                  <span className="font-mono text-[10px] text-slate-500 block uppercase">Isolation Boundary</span>
                  <span className="font-mono font-bold text-slate-900">{finding.detection_layer ?? "—"}</span>
                </div>
              </div>

              <div className="rounded border border-slate-200/80 bg-slate-50/70 p-3 text-xs space-y-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Exposed Blast Surface
                </span>
                <p className="font-mono text-xs text-slate-800 break-all">
                  {finding.blast_radius ?? "No blast radius was recorded for this finding."}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800 block">
                Security Posture Impact
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                {finding.remediation_hint ?? "No impact assessment or remediation guidance was recorded for this finding."}
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: Chain of Custody */}
        {activeTab === "custody" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-1">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800">
                Inter-Agent Cryptographic Trail
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Cryptographic HMAC signatures verifiable across each agent hop in the custody chain.
              </p>
            </div>

            {finding.custody_chain?.length ? (
              <FindingCustodyTrail chain={finding.custody_chain} />
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-center text-xs text-slate-500">
                No intermediate agent hops recorded for this telemetry finding.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="border-t border-slate-200 bg-slate-50/80 px-6 py-3 flex items-center justify-between">
        <span className="font-mono text-[11px] text-slate-500">
          Status: <strong className="text-slate-800 uppercase">{finding.status}</strong>
          {finding.playbook_version && ` · Enforced in Playbook v${finding.playbook_version}`}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={onClose}
          className="border-slate-200 font-mono text-xs text-slate-700 hover:bg-slate-100"
        >
          Close Inspector
        </Button>
      </div>
    </div>
  );
}
