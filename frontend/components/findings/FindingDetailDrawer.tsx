"use client";

import { useState } from "react";
import Link from "next/link";
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Code,
  Layers,
  Activity,
  Copy,
  Check,
  ArrowUpRight,
  BookMarked,
  Terminal,
  FileCheck2,
  Cpu,
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
  const [copiedSample, setCopiedSample] = useState(false);

  if (!finding) return null;

  const handleCopyPrompt = () => {
    if (finding.attack_prompt) {
      void navigator.clipboard.writeText(finding.attack_prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const handleCopySample = () => {
    if (finding.exploit_sample) {
      void navigator.clipboard.writeText(finding.exploit_sample);
      setCopiedSample(true);
      setTimeout(() => setCopiedSample(false), 2000);
    }
  };

  const isContained = finding.verdict?.toUpperCase() === "CONTAINED";
  const isBreached = finding.verdict?.toUpperCase() === "BREACHED";

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-neutral-800 bg-[#0a0a0a] text-neutral-100 shadow-2xl animate-in slide-in-from-right duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={`Finding inspection: ${finding.title}`}
    >
      {/* Top Header Bar */}
      <div className="flex items-start justify-between border-b border-neutral-800 px-6 py-4 bg-[#0e0e0e]">
        <div className="min-w-0 pr-4">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-xs font-bold text-neutral-200 bg-[#141414] border border-neutral-800 px-2 py-0.5 rounded shadow-2xs">
              {finding.id}
            </span>
            <SeverityBadge severity={finding.severity} />
            {finding.asi_code && (
              <Badge variant="outline" className="border-neutral-800 bg-[#141414] font-mono text-[10px] font-bold text-neutral-200">
                {finding.asi_code}
              </Badge>
            )}
            <span
              className={cn(
                "rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                isContained
                  ? "bg-emerald-950/40 text-emerald-400 border border-emerald-800/60"
                  : isBreached
                  ? "bg-rose-950/40 text-rose-400 border border-rose-800/60"
                  : "bg-amber-950/40 text-amber-400 border border-amber-800/60"
              )}
            >
              {finding.verdict ?? "UNCLASSIFIED"}
            </span>
          </div>

          <h2 className="text-base font-bold text-white leading-snug">
            {finding.title}
          </h2>
          <p className="mt-1 font-mono text-xs text-neutral-400">
            Target Agent: <span className="font-semibold text-neutral-200">{finding.target_agent ?? "—"}</span>
            {finding.target_model && (
              <>
                <span className="text-neutral-600 px-1.5">·</span>
                Model: <span className="text-neutral-300">{finding.target_model}</span>
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
          aria-label="Close inspection drawer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Quick Action Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-4 sm:px-6 py-2.5 bg-[#0c0c0c]">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-neutral-400">
          <span>Impact Score:</span>
          <span className="font-bold text-white">{finding.impact_score == null ? "—" : `${finding.impact_score}/100`}</span>
          <span className="text-neutral-700 hidden xs:inline">|</span>
          <span className="hidden xs:inline">Category:</span>
          <span className="text-neutral-300 truncate max-w-[200px]">{finding.category}</span>
          {finding.mitre_atlas && (
            <>
              <span className="text-neutral-700 hidden xs:inline">|</span>
              <span className="text-neutral-400 text-[11px]">{finding.mitre_atlas}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {finding.source_ref ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-7 text-xs border-neutral-800 bg-[#161616] font-mono gap-1 text-neutral-200 hover:bg-neutral-800 hover:text-white shadow-2xs"
            >
              <Link href={`/replay?session=${encodeURIComponent(finding.source_ref)}`}>
                <span>Replay Turn</span>
                <ArrowUpRight className="h-3 w-3 text-neutral-400" />
              </Link>
            </Button>
          ) : (
            <span className="font-mono text-[11px] text-neutral-500">Replay unavailable</span>
          )}
        </div>
      </div>

      {/* Navigation Segmented Tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-800 px-4 sm:px-6 pt-2 bg-neutral-900/40 overflow-x-auto scrollbar-none whitespace-nowrap">
        <button
          type="button"
          onClick={() => setActiveTab("exploit")}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold font-mono transition-colors shrink-0",
            activeTab === "exploit"
              ? "border-white text-white bg-[#0a0a0a] rounded-t shadow-2xs"
              : "border-transparent text-neutral-400 hover:text-white hover:bg-neutral-900/50"
          )}
        >
          <Code className="h-3.5 w-3.5" />
          <span>Proof of Exploit</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("remediation")}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold font-mono transition-colors shrink-0",
            activeTab === "remediation"
              ? "border-white text-white bg-[#0a0a0a] rounded-t shadow-2xs"
              : "border-transparent text-neutral-400 hover:text-white hover:bg-neutral-900/50"
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
              ? "border-white text-white bg-[#0a0a0a] rounded-t shadow-2xs"
              : "border-transparent text-neutral-400 hover:text-white hover:bg-neutral-900/50"
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
              ? "border-white text-white bg-[#0a0a0a] rounded-t shadow-2xs"
              : "border-transparent text-neutral-400 hover:text-white hover:bg-neutral-900/50"
          )}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Chain of Custody</span>
        </button>
      </div>

      {/* Main Drawer Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* TAB 1: Proof of Exploit & Evidence */}
        {activeTab === "exploit" && (
          <div className="space-y-5">
            {/* Exploit Prompt Terminal Block */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-neutral-400" />
                  Adversarial Probe Payload (Red Team Dispatch)
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs font-mono text-neutral-400 hover:text-white"
                  onClick={handleCopyPrompt}
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="mr-1 h-3 w-3 text-emerald-400" />
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
              <div className="rounded-lg border border-neutral-800 bg-[#070707] p-3.5 text-xs font-mono text-neutral-200 shadow-inner overflow-x-auto whitespace-pre-wrap leading-relaxed selection:bg-neutral-800 selection:text-white">
                {finding.attack_prompt || "No prompt vector captured."}
              </div>
            </div>

            {/* Proof of Exploit Output Block */}
            {finding.exploit_sample ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <FileCheck2 className="h-3.5 w-3.5 text-amber-400" />
                    Observed Target Response &amp; Breach Evidence
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs font-mono text-neutral-400 hover:text-white"
                    onClick={handleCopySample}
                  >
                    {copiedSample ? (
                      <>
                        <Check className="mr-1 h-3 w-3 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-3 w-3" />
                        Copy Evidence
                      </>
                    )}
                  </Button>
                </div>
                <div className="rounded-lg border border-rose-900/40 bg-[#120808] p-3.5 text-xs font-mono text-rose-200/90 shadow-inner overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {finding.exploit_sample}
                </div>
              </div>
            ) : null}

            {/* Forensic Judge Reasoning */}
            <div className="space-y-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-neutral-400" />
                Judge Agent Arbitration &amp; Score
              </span>
              <div className="rounded-lg border border-neutral-800 bg-[#111111] p-4 text-xs text-neutral-200 leading-relaxed space-y-2.5">
                <p className="font-medium text-white">
                  {finding.reasoning || "No evaluation rationale was recorded for this finding."}
                </p>
                {finding.detection_layer && (
                  <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-[11px] font-mono text-neutral-400">
                    <span>Interception Sensor:</span>
                    <span className="font-bold text-neutral-200">{finding.detection_layer}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Remediation Guidance */}
            {finding.remediation_hint && (
              <div className="rounded-lg border border-neutral-800 bg-[#111111] p-4 space-y-1.5">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Recommended Defense Architecture
                </span>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {finding.remediation_hint}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Policy Hotpatch & Playbook Promotion */}
        {activeTab === "remediation" && (
          <div className="space-y-5">
            <div className="rounded-lg border border-neutral-800 bg-[#111111] p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200 font-mono flex items-center gap-1.5">
                <BookMarked className="h-3.5 w-3.5 text-emerald-400" />
                Automated Closed-Loop Policy Synthesis
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Generate and review a runtime mitigation rule directly from this exploit payload. Once promoted, the Defender agent hot-patches active proxy gates.
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
            <div className="rounded-lg border border-neutral-800 bg-[#111111] p-4 space-y-3 shadow-2xs">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-200 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-neutral-400" />
                Agent Identity &amp; Permissions Surface
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded border border-neutral-800 bg-[#161616] p-2.5">
                  <span className="font-mono text-[10px] text-neutral-400 block uppercase">Target Agent</span>
                  <span className="font-mono font-bold text-white">{finding.target_agent ?? "—"}</span>
                </div>
                <div className="rounded border border-neutral-800 bg-[#161616] p-2.5">
                  <span className="font-mono text-[10px] text-neutral-400 block uppercase">Isolation Boundary</span>
                  <span className="font-mono font-bold text-white">{finding.detection_layer ?? "—"}</span>
                </div>
                <div className="rounded border border-neutral-800 bg-[#161616] p-2.5">
                  <span className="font-mono text-[10px] text-neutral-400 block uppercase">Target Model</span>
                  <span className="font-mono font-bold text-white">{finding.target_model ?? "—"}</span>
                </div>
                <div className="rounded border border-neutral-800 bg-[#161616] p-2.5">
                  <span className="font-mono text-[10px] text-neutral-400 block uppercase">Namespace</span>
                  <span className="font-mono font-bold text-white">{finding.namespace ?? "default"}</span>
                </div>
              </div>

              <div className="rounded border border-neutral-800 bg-[#161616] p-3 text-xs space-y-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                  Exposed Blast Surface
                </span>
                <p className="font-mono text-xs text-neutral-200 break-all leading-relaxed">
                  {finding.blast_radius ?? "No blast radius was recorded for this finding."}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-800 bg-[#111111] p-4 space-y-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-200 block">
                Security Posture Impact
              </span>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {finding.remediation_hint ?? "No impact assessment or remediation guidance was recorded for this finding."}
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: Chain of Custody */}
        {activeTab === "custody" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-neutral-800 bg-[#111111] p-4 space-y-1">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-200">
                Inter-Agent Cryptographic Trail
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Cryptographic HMAC signatures verifiable across each agent hop in the custody chain.
              </p>
            </div>

            {finding.custody_chain?.length ? (
              <FindingCustodyTrail chain={finding.custody_chain} />
            ) : (
              <div className="rounded-lg border border-neutral-800 bg-[#111111] p-4 text-center text-xs text-neutral-400">
                No intermediate agent hops recorded for this telemetry finding.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="border-t border-neutral-800 bg-[#0e0e0e] px-6 py-3 flex items-center justify-between">
        <span className="font-mono text-[11px] text-neutral-400">
          Status: <strong className="text-white uppercase">{finding.status}</strong>
          {finding.playbook_version && ` · Enforced in Playbook v${finding.playbook_version}`}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={onClose}
          className="border-neutral-800 bg-[#141414] font-mono text-xs text-neutral-200 hover:bg-neutral-800 hover:text-white"
        >
          Close Inspector
        </Button>
      </div>
    </div>
  );
}
