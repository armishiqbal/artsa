"use client";

import { CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { AgentRoleBadge } from "@/components/pipeline/AgentStatusStrip";
import type { PipelineAgentId } from "@/lib/agentRoles";

interface FindingCustodyTrailProps {
  chain: Array<{
    agent: string;
    label: string;
    action: string;
    hmac_verified: boolean | null;
  }>;
}

export function FindingCustodyTrail({ chain }: FindingCustodyTrailProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#121212] p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div>
          <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Handoff Verification Status
          </h4>
          <p className="mt-0.5 text-[11px] text-neutral-400">
            Cryptographic HMAC-SHA256 signature chain across sequential agent hops
          </p>
        </div>
        <span className="rounded-full border border-emerald-800/60 bg-emerald-950/40 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
          HMAC-SHA256
        </span>
      </div>
      <ol className="space-y-2">
        {chain.map((hop, idx) => {
          const agentId = hop.agent as PipelineAgentId;
          return (
            <li
              key={`${hop.agent}-${idx}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-neutral-800 bg-[#161616] px-3.5 py-2.5 transition-colors hover:border-neutral-700"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-neutral-500">0{idx + 1}</span>
                  <AgentRoleBadge agentId={agentId} />
                </div>
                <p className="mt-1 text-xs text-neutral-300 leading-snug">{hop.action}</p>
                <p className="mt-0.5 font-mono text-[10px] text-neutral-500">{hop.label}</p>
              </div>
              <div className="shrink-0 text-xs pt-0.5">
                {hop.hmac_verified === true ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Verified
                  </span>
                ) : hop.hmac_verified === false ? (
                  <span className="font-mono text-[11px] font-semibold text-rose-400">Mismatch</span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-neutral-500">
                    <Lock className="h-3 w-3" aria-hidden />
                    Not provided
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
