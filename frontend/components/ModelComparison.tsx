"use client";

import { useState, useMemo } from "react";
import { GitCompare, X, ArrowUpDown, Shield, Zap, Target } from "lucide-react";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CampaignSummary {
  id: string;
  name: string;
  provider: string;
  model: string;
  status: string;
  rounds_completed: number;
  total_rounds: number;
  summary?: Record<string, unknown>;
}

interface ModelComparisonProps {
  campaigns: CampaignSummary[];
}

export default function ModelComparison({ campaigns }: ModelComparisonProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelection = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const selectedCampaigns = useMemo(
    () => campaigns.filter((c) => selected.includes(c.id)),
    [campaigns, selected]
  );

  const metrics = useMemo(() => {
    return selectedCampaigns.map((c) => {
      const s = c.summary ?? {};
      return {
        id: c.id,
        label: `${String(c.provider).slice(0, 10)} / ${String(c.model).slice(0, 20)}`,
        totalRounds: c.total_rounds || c.rounds_completed || 0,
        riskScore: (s as Record<string, number>).avg_risk_score ?? (s as Record<string, number>).risk_score ?? 0,
        blocked: (s as Record<string, number>).blocked_count ?? (s as Record<string, unknown>)?.results_by_verdict as Record<string, number> | undefined,
        defenseQuality: (s as Record<string, number>).avg_defense_quality ?? 0,
        breached: typeof (s as Record<string, unknown>)?.results_by_verdict === "object"
          ? ((s as Record<string, unknown>).results_by_verdict as Record<string, number>)?.BREACHED ?? 0
          : 0,
      };
    });
  }, [selectedCampaigns]);

  if (campaigns.length === 0) {
    return (
      <DashboardCard title="Model Comparison" description="Compare campaign results across different models">
        <p className="text-sm text-muted-foreground">Run at least 2 campaigns to compare models.</p>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      title="Model Comparison"
      description="Select up to 4 campaigns to compare side-by-side"
      badge={
        selected.length >= 2 && (
          <Badge variant="info" className="font-mono text-[10px]">
            {selected.length} selected
          </Badge>
        )
      }
    >
      {/* Campaign selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {campaigns.map((c) => (
          <Button
            key={c.id}
            variant={selected.includes(c.id) ? "default" : "outline"}
            size="sm"
            className="font-mono text-xs"
            onClick={() => toggleSelection(c.id)}
          >
            {String(c.provider).slice(0, 8)}/{String(c.model).slice(0, 12)}
            {selected.includes(c.id) && <X className="ml-1 h-3 w-3" />}
          </Button>
        ))}
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelected([])}>
            Clear all
          </Button>
        )}
      </div>

      {metrics.length >= 2 ? (
        <div className="space-y-6">
          {/* Comparison table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-left font-medium text-muted-foreground">Metric</th>
                  {metrics.map((m) => (
                    <th key={m.id} className="py-2 px-3 text-center font-medium text-foreground">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-2 pr-4 font-medium text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" /> Total Rounds
                    </span>
                  </td>
                  {metrics.map((m) => (
                    <td key={m.id} className="py-2 px-3 text-center font-mono tabular-nums">
                      {m.totalRounds}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Defense Quality
                    </span>
                  </td>
                  {metrics.map((m) => (
                    <td
                      key={m.id}
                      className={`py-2 px-3 text-center font-mono tabular-nums ${
                        m.defenseQuality >= 7 ? "text-emerald-400" : m.defenseQuality >= 4 ? "text-amber-400" : "text-rose-400"
                      }`}
                    >
                      {m.defenseQuality}/10
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Avg Risk Score
                    </span>
                  </td>
                  {metrics.map((m) => (
                    <td
                      key={m.id}
                      className={`py-2 px-3 text-center font-mono tabular-nums ${
                        m.riskScore <= 30 ? "text-emerald-400" : m.riskScore <= 60 ? "text-amber-400" : "text-rose-400"
                      }`}
                    >
                      {Number(m.riskScore).toFixed(1)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ArrowUpDown className="h-3 w-3" /> Breached
                    </span>
                  </td>
                  {metrics.map((m) => (
                    <td
                      key={m.id}
                      className={`py-2 px-3 text-center font-mono tabular-nums ${
                        m.breached === 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {m.breached}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Visual bar comparison */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Defense Quality Comparison</p>
            {metrics.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <span className="w-28 text-xs text-muted-foreground truncate">{m.label}</span>
                <div className="flex-1 rounded-full bg-muted h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      m.defenseQuality >= 7
                        ? "bg-emerald-500"
                        : m.defenseQuality >= 4
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                    style={{ width: `${(m.defenseQuality / 10) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-xs tabular-nums w-10 text-right">{m.defenseQuality}/10</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <GitCompare className="h-4 w-4" />
          Select 2 or more campaigns above to compare.
        </div>
      )}
    </DashboardCard>
  );
}
