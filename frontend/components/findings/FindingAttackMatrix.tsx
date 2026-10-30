"use client";

import { useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Database,
  Layers,
  Network,
  Cpu,
  Flame,
} from "lucide-react";
import type { ExtendedFinding } from "@/lib/types/findings";
import { cn } from "@/lib/utils";

interface FindingAttackMatrixProps {
  findings: ExtendedFinding[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
}

interface ThreatCategorySummary {
  id: string;
  asiCode: string;
  mitreAtlas: string;
  title: string;
  description: string;
  icon: typeof ShieldAlert;
  color: string;
  count: number;
  criticalCount: number;
  breachedCount: number;
  containedCount: number;
}

export function FindingAttackMatrix({
  findings,
  activeCategory,
  onSelectCategory,
}: FindingAttackMatrixProps) {
  const categories = useMemo<ThreatCategorySummary[]>(() => {
    const specs = [
      {
        id: "ASI-01",
        asiCode: "ASI-01",
        mitreAtlas: "AML.T0054",
        title: "Prompt Injection & Jailbreak",
        description: "Direct token override & system instruction bypass",
        icon: Terminal,
        color: "rose",
      },
      {
        id: "ASI-02",
        asiCode: "ASI-02",
        mitreAtlas: "AML.T0037",
        title: "Sensitive Info Disclosure / IMDS",
        description: "Cloud metadata SSRF & STS credential exfiltration",
        icon: Network,
        color: "rose",
      },
      {
        id: "ASI-06",
        asiCode: "ASI-06",
        mitreAtlas: "AML.T0040",
        title: "Excessive Agency & DDL Execution",
        description: "Unauthorized database schema mutation & tool abuse",
        icon: Database,
        color: "amber",
      },
      {
        id: "ASI-08",
        asiCode: "ASI-08",
        mitreAtlas: "AML.T0043",
        title: "Vector & RAG Poisoning",
        description: "Adversarial chunk injection in vector retrieval indexes",
        icon: Layers,
        color: "amber",
      },
      {
        id: "ASI-05",
        asiCode: "ASI-05",
        mitreAtlas: "AML.T0025",
        title: "Cross-Tenant State Spill",
        description: "Multi-tenant session cache leakage in shared agent pods",
        icon: Cpu,
        color: "slate",
      },
      {
        id: "ASI-04",
        asiCode: "ASI-04",
        mitreAtlas: "AML.T0029",
        title: "Denial of Wallet & Tool Storm",
        description: "Recursive subagent invocation loops & quota drain",
        icon: Flame,
        color: "slate",
      },
    ];

    return specs.map((spec) => {
      const matching = findings.filter(
        (f) => f.asi_code === spec.asiCode || (f.category && f.category.toLowerCase().includes(spec.title.toLowerCase().slice(0, 10)))
      );
      const criticalCount = matching.filter((f) => f.severity === "CRITICAL").length;
      const breachedCount = matching.filter((f) => f.verdict?.toUpperCase() === "BREACHED").length;
      const containedCount = matching.filter((f) => f.verdict?.toUpperCase() === "CONTAINED").length;

      return {
        ...spec,
        count: matching.length,
        criticalCount,
        breachedCount,
        containedCount,
      };
    });
  }, [findings]);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 px-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-700">
            MITRE ATLAS &amp; OWASP LLM Attack Surface Matrix
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">
            6 Vector Taxonomy
          </span>
        </div>
        {activeCategory !== "ALL" && (
          <button
            type="button"
            onClick={() => onSelectCategory("ALL")}
            className="font-mono text-[11px] font-semibold text-slate-900 hover:text-black transition-colors self-start sm:self-auto"
          >
            ← View All Categories
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.asiCode;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(isActive ? "ALL" : cat.asiCode)}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border p-2.5 sm:p-3 text-left transition-all shadow-2xs hover:shadow-xs min-w-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-900",
                isActive
                  ? "border-black bg-slate-100 ring-2 ring-black/10"
                  : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/50"
              )}
            >
              {/* Header: ASI Code & MITRE Tag */}
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 shrink-0">
                  {cat.asiCode}
                </span>
                <span className="font-mono text-[9px] font-semibold text-slate-500 truncate" title={cat.mitreAtlas}>
                  {cat.mitreAtlas}
                </span>
              </div>

              {/* Title & Description */}
              <div className="space-y-1 mb-2 min-w-0 flex-1">
                <div className="flex items-start gap-1.5 min-w-0">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", 
                    cat.color === "rose" ? "text-rose-600" :
                    cat.color === "amber" ? "text-amber-600" : "text-slate-600"
                  )} />
                  <p className="font-semibold text-xs text-slate-900 leading-tight group-hover:text-slate-950 transition-colors line-clamp-2 min-h-[2rem]">
                    {cat.title}
                  </p>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed hidden lg:block">
                  {cat.description}
                </p>
              </div>

              {/* Metrics Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 font-mono text-[10px] min-w-0">
                <span className="font-bold text-slate-900 shrink-0">
                  {cat.count} {cat.count === 1 ? "Probe" : "Probes"}
                </span>
                {cat.breachedCount > 0 ? (
                  <span className="font-bold text-rose-600 flex items-center gap-0.5 truncate">
                    <ShieldAlert className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{cat.breachedCount} Breached</span>
                  </span>
                ) : cat.containedCount > 0 ? (
                  <span className="font-bold text-emerald-600 flex items-center gap-0.5 truncate">
                    <ShieldCheck className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">Contained</span>
                  </span>
                ) : (
                  <span className="text-slate-400">0 Open</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
