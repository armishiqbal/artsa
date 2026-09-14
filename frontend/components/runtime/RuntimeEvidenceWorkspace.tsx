"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, ExternalLink, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import { toast } from "@/lib/stores/toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";
import { DashboardCard } from "@/components/shared/DashboardCard";

type Approval = {
  id: string;
  session_id: string;
  tool_name: string;
  status: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED";
  expires_at: string;
  created_at: string;
};

type Evidence = {
  id: string;
  action_id: string;
  session_id: string;
  trace_id: string;
  agent_id: string;
  github_installation_id: string;
  repository: string;
  tool: string;
  policy_version: string;
  outcome: "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL" | "UNAVAILABLE";
  reason_codes: string[];
  finding_categories: string[];
  approval_id?: string | null;
  execution_state: "PENDING" | "EXECUTED" | "FAILED" | "OUTPUT_BLOCKED" | "CANCELLED";
  execution_latency_ms?: number | null;
  github_issue_number?: number | null;
  reconciled_at?: string | null;
  created_at: string;
};

function stateClass(state: string) {
  if (state === "ALLOW" || state === "EXECUTED" || state === "APPROVED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (state === "BLOCK" || state === "OUTPUT_BLOCKED" || state === "DENIED") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  if (state === "REQUIRE_APPROVAL" || state === "PENDING") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-border bg-muted text-muted-foreground";
}

function Status({ value }: { value: string }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 font-mono text-[11px] font-semibold ${stateClass(value)}`}>{value.replaceAll("_", " ")}</span>;
}

function relativeTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Unknown time" : date.toLocaleString();
}

export function RuntimeEvidenceWorkspace({ mode }: { mode: "approvals" | "investigations" }) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [approvalRows, evidenceRows] = await Promise.all([
      fetchFromBackend<Approval[]>("/api/v1/approvals", { silent: true }),
      fetchFromBackend<Evidence[]>("/api/v1/mcp/evidence?limit=50", { silent: true }),
    ]);
    setApprovals(Array.isArray(approvalRows) ? approvalRows : []);
    setEvidence(Array.isArray(evidenceRows) ? evidenceRows : []);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const decide = async (id: string, decision: "APPROVE" | "DENY") => {
    setActing(id);
    const result = await fetchFromBackend(`/api/v1/approvals/${id}/decision`, {
      method: "POST", body: JSON.stringify({ decision }),
    });
    if (result) {
      toast(decision === "APPROVE" ? "Action authorized for one identical retry" : "Action denied", { variant: "success" });
      await refresh();
    }
    setActing(null);
  };

  const pending = useMemo(() => approvals.filter((row) => row.status === "PENDING"), [approvals]);
  const linked = useMemo(() => new Map(evidence.filter((row) => row.approval_id).map((row) => [row.approval_id!, row])), [evidence]);

  if (mode === "approvals") {
    return (
      <PageStack>
      <PageHeader title="Approvals" description="Review the exact agent authority boundary before an external GitHub write can run." icon={<ShieldAlert className="h-5 w-5" />} actions={<><Button asChild variant="outline" size="sm"><Link href="/investigations">Investigation timeline <ExternalLink className="h-3.5 w-3.5" /></Link></Button><Button asChild variant="outline" size="sm"><Link href="/agents">Managed agents</Link></Button></>} />
        {!loading && pending.length === 0 ? <EmptyState icon={ShieldCheck} title="No actions need approval" description="New approval-required agent actions will appear here with redacted scope and expiry." variant="hero" /> : (
          <div className="grid gap-4 xl:grid-cols-2">
            {pending.map((approval) => {
              const event = linked.get(approval.id);
              return <DashboardCard key={approval.id} title={approval.tool_name.replaceAll("_", " ")} description={`Requested ${relativeTime(approval.created_at)}`} className="border-amber-500/20" actions={<Status value={approval.status} />}>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">Agent</dt><dd className="mt-1 font-medium">{event?.agent_id ?? "Not yet linked"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Repository</dt><dd className="mt-1 font-mono text-xs">{event?.repository ?? "Redacted scope pending"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Policy</dt><dd className="mt-1 font-mono text-xs">{event?.policy_version ?? "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Expires</dt><dd className="mt-1">{relativeTime(approval.expires_at)}</dd></div>
                </dl>
                <p className="mt-4 text-xs text-muted-foreground">Approval is one-time and bound to this tenant, agent, repository, tool, arguments digest, and policy version.</p>
                <div className="mt-4 flex gap-2"><Button size="sm" onClick={() => void decide(approval.id, "APPROVE")} disabled={acting === approval.id}><Check className="h-4 w-4" />Approve once</Button><Button size="sm" variant="outline" onClick={() => void decide(approval.id, "DENY")} disabled={acting === approval.id}><X className="h-4 w-4" />Deny</Button></div>
              </DashboardCard>;
            })}
          </div>
        )}
      </PageStack>
    );
  }

  return (
    <PageStack>
      <PageHeader title="Investigations" description="A redacted, reverse-chronological record of real managed MCP decisions and execution states." icon={<Clock3 className="h-5 w-5" />} actions={<><Button asChild variant="outline" size="sm"><Link href="/approvals">Approvals <ExternalLink className="h-3.5 w-3.5" /></Link></Button><Button asChild variant="outline" size="sm"><Link href="/integrations/github">GitHub inventory</Link></Button></>} />
      {!loading && evidence.length === 0 ? <EmptyState icon={Clock3} title="No managed actions yet" description="When a registered agent calls the ARTSA MCP gateway, its policy decision appears here. No prompts, tool arguments, GitHub content, tokens, or raw output are retained." variant="hero" /> : (
        <section className="space-y-3" aria-label="Managed action evidence">
          {evidence.map((event) => <DashboardCard key={event.id} title={event.tool.replaceAll("_", " ")} description={`${relativeTime(event.created_at)} · ${event.repository}`} actions={<div className="flex gap-2"><Status value={event.outcome} /><Status value={event.execution_state} /></div>}>
            <div className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-3">
              <div><span className="text-xs text-muted-foreground">Agent</span><p className="mt-1 font-medium">{event.agent_id}</p></div>
              <div><span className="text-xs text-muted-foreground">Policy</span><p className="mt-1 font-mono text-xs">{event.policy_version}</p></div>
              <div><span className="text-xs text-muted-foreground">Latency</span><p className="mt-1">{event.execution_latency_ms == null ? "Not executed" : `${event.execution_latency_ms} ms`}</p></div>
              <div><span className="text-xs text-muted-foreground">GitHub reconciliation</span><p className="mt-1">{event.reconciled_at ? `Confirmed ${relativeTime(event.reconciled_at)}` : event.github_issue_number ? "Awaiting signed issue webhook" : "Not applicable"}</p></div>
              <div className="md:col-span-3"><span className="text-xs text-muted-foreground">Decision reasons</span><p className="mt-1 text-muted-foreground">{event.reason_codes.length ? event.reason_codes.join(", ") : "No additional reason code"}</p></div>
            </div>
            <details className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">Redacted technical identifiers</summary><div className="mt-3 grid gap-2 font-mono"><p>Correlation ID: {event.trace_id}</p><p>Action ID: {event.action_id}</p><p>GitHub installation: {event.github_installation_id}</p></div></details>
          </DashboardCard>)}
        </section>
      )}
    </PageStack>
  );
}
