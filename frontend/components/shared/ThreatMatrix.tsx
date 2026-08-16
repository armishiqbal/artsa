"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldAlert, Zap } from "lucide-react";
import { useTopologyThreats } from "@/lib/hooks/useTopologyThreats";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ThreatRow } from "@/components/shared/ThreatRow";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { severityFromScore } from "@/lib/severity";

export function ThreatMatrix() {
  const router = useRouter();
  const { threats, loading } = useTopologyThreats();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("ALL");

  const displayedThreats = threats;

  const filtered = useMemo(() => {
    return displayedThreats.filter((t) => {
      const severity = severityFromScore(t.risk_score);
      const matchesSearch =
        t.agent_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.session_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.status.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = selectedFilter === "ALL" || severity === selectedFilter;
      return matchesSearch && matchesFilter;
    });
  }, [displayedThreats, searchTerm, selectedFilter]);

  return (
    <DashboardCard
      title="Live Threat Matrix"
      description="High-risk sessions from topology — click to open forensic replay"
      badge={
        <Badge variant={displayedThreats.length ? "success" : "secondary"} className="font-mono text-[10px]">
          {loading ? "…" : `${displayedThreats.length} active`}
        </Badge>
      }
    >
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            type="text"
            placeholder="Search by agent or session…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 font-mono text-xs"
            disabled={loading || displayedThreats.length === 0}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((filter) => (
            <Button
              key={filter}
              variant={selectedFilter === filter ? "default" : "outline"}
              size="sm"
              className="font-mono text-xs"
              onClick={() => setSelectedFilter(filter)}
              disabled={loading || displayedThreats.length === 0}
            >
              {filter}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        displayedThreats.length > 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="No threats match your filter"
            description="Try clearing the search or picking a different severity."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedFilter("ALL");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ShieldAlert}
            title="No active threats"
            description="Ingest tool calls via POST /api/v1/ingest or launch a wargame campaign to populate live sessions."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild size="sm">
                  <Link href="/campaigns">Launch wargame</Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push("/admin/providers")}>
                  Manage providers
                </Button>
              </div>
            }
          />
        )
      ) : (
        <div className="space-y-2">
          {filtered.map((threat, i) => (
            <ThreatRow key={threat.session_id} threat={threat} rank={i + 1} />
          ))}
        </div>
      )}

      {displayedThreats.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" className="gap-2 font-mono text-xs" onClick={() => router.push("/dashboard/topology")}>
            <Zap className="h-3.5 w-3.5" aria-hidden />
            View topology graph
          </Button>
        </div>
      )}
    </DashboardCard>
  );
}
