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

export function ThreatMatrix() {
  const router = useRouter();
  const { threats, loading } = useTopologyThreats();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return threats.filter((t) => {
      const severity =
        t.risk_score >= 80 ? "CRITICAL" : t.risk_score >= 60 ? "HIGH" : t.risk_score >= 40 ? "MEDIUM" : "LOW";
      const matchesSearch =
        t.agent_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.session_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.status.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = selectedFilter === "ALL" || severity === selectedFilter;
      return matchesSearch && matchesFilter;
    });
  }, [threats, searchTerm, selectedFilter]);

  return (
    <DashboardCard
      title="Live Threat Matrix"
      description="High-risk sessions from topology — click to open forensic replay"
      badge={
        <Badge variant={threats.length ? "success" : "secondary"} className="font-mono text-[10px]">
          {loading ? "…" : `${threats.length} active`}
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
            disabled={loading || threats.length === 0}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["ALL", "CRITICAL", "HIGH", "MEDIUM"].map((filter) => (
            <Button
              key={filter}
              variant={selectedFilter === filter ? "default" : "outline"}
              size="sm"
              className="font-mono text-[10px]"
              onClick={() => setSelectedFilter(filter)}
              disabled={loading || threats.length === 0}
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
      ) : threats.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No active threats"
          description="Ingest tool calls via POST /api/v1/ingest or launch a wargame campaign to populate live sessions."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm">
                <Link href="/wargame">Launch wargame</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push("/providers")}>
                Configure providers
              </Button>
            </div>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No matching threats"
          description="Adjust filters or wait for high-risk sessions to appear."
          className="py-8"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((threat, i) => (
            <ThreatRow key={threat.session_id} threat={threat} rank={i + 1} />
          ))}
        </div>
      )}

      {threats.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" className="gap-2 font-mono text-xs" onClick={() => router.push("/topology")}>
            <Zap className="h-3.5 w-3.5" aria-hidden />
            View topology graph
          </Button>
        </div>
      )}
    </DashboardCard>
  );
}
