"use client";

import { useCommandCenterAgentInventory } from "@/lib/hooks/useCommandCenterAgentInventory";
import { Activity, Bot, ChevronRight, CircleAlert, RefreshCw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

function formatTimestamp(value: string | null) {
  if (!value) return "No activity recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

function StatusBadge({ status, enabled }: { status: string; enabled: boolean | null }) {
  const label = enabled === false ? "Disabled" : status.replaceAll("_", " ").toLowerCase();
  const tone = enabled === false || ["QUARANTINED", "BREACHED"].includes(status.toUpperCase())
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : status.toUpperCase() === "AT_RISK"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : enabled === true
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return <span className={cn("inline-flex rounded-full border px-2 py-1 text-[11px] font-medium capitalize", tone)}>{label}</span>;
}

export function CommandCenterAgentInventory() {
  const inventory = useCommandCenterAgentInventory();
  const { agents, selectedAgent } = inventory;

  return (
    <section aria-labelledby="agent-inventory-title" className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Tenant integrations</p>
          <h2 id="agent-inventory-title" className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Connected tenant agents</h2>
          <p className="mt-1 text-sm text-slate-600">Organization agents with declared MCP access and observed activity. Campaign roles are managed internally.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2.5 py-1.5 text-sm font-medium tabular-nums text-slate-700">
            {inventory.loading ? "…" : inventory.unavailable ? "Unavailable" : `${agents.length} agents`}
          </span>
          <button type="button" onClick={inventory.refresh} aria-label="Refresh agent inventory" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"><RefreshCw className="h-4 w-4" aria-hidden /></button>
        </div>
      </div>

      {inventory.loading ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500" role="status">Loading registered agents…</div>
      ) : inventory.unavailable ? (
        <div className="flex items-start gap-3 px-5 py-6 text-sm text-amber-800 sm:px-6">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Agent inventory is unavailable. Check the API connection before treating this list as complete.</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Bot className="h-4 w-4" aria-hidden /></span>
            <div><p className="text-sm font-medium text-slate-800">No tenant agents are connected</p><p className="mt-0.5 text-xs text-slate-500">Connect an organization agent to view its declared access and observed activity here.</p></div>
          </div>
          <Link href="/agents" className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">Manage agents<ChevronRight className="h-4 w-4" aria-hidden /></Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 sm:px-6">Agent</th>
                  <th scope="col" className="px-4 py-3">Owner</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Latest observed tool</th>
                  <th scope="col" className="px-4 py-3">Sessions</th>
                  <th scope="col" className="px-5 py-3 sm:px-6">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agents.map((agent) => {
                  const selected = agent.id === inventory.selectedAgent?.id;
                  return (
                    <tr key={agent.id}>
                      <td colSpan={6} className="p-0">
                        <button
                          type="button"
                          onClick={() => inventory.selectAgent(agent.id)}
                          aria-pressed={selected}
                          className={cn("grid w-full grid-cols-[minmax(190px,1.1fr)_minmax(120px,.8fr)_minmax(115px,.7fr)_minmax(150px,1fr)_70px_minmax(180px,1fr)] items-center text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600", selected && "bg-sky-50/70")}
                        >
                          <span className="flex min-w-0 items-center gap-3 px-5 py-3.5 sm:px-6">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500"><Bot className="h-4 w-4" aria-hidden /></span>
                            <span className="min-w-0"><span className="block truncate font-medium text-slate-900">{agent.name}</span><span className="block truncate text-xs text-slate-500">{agent.agent_type} · {agent.provider ?? "provider not set"}</span></span>
                          </span>
                          <span className="truncate px-4 py-3.5 text-slate-700">{agent.owner ?? "Not specified"}</span>
                          <span className="px-4 py-3.5"><StatusBadge status={agent.status} enabled={agent.enabled} /></span>
                          <span className="truncate px-4 py-3.5 font-mono text-xs text-slate-700">{agent.last_tool_name ?? "No tool event"}</span>
                          <span className="px-4 py-3.5 tabular-nums text-slate-700">{agent.session_count}</span>
                          <span className="flex items-center justify-between gap-3 px-5 py-3.5 text-xs text-slate-600 sm:px-6"><span className="truncate">{formatTimestamp(agent.last_activity)}</span><ChevronRight className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", selected && "rotate-90 text-sky-700")} aria-hidden /></span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedAgent ? (
            <div className="grid gap-0 border-t border-slate-200 lg:grid-cols-[minmax(260px,.8fr)_minmax(0,1.2fr)]">
              <aside className="border-b border-slate-200 px-5 py-5 sm:px-6 lg:border-b-0 lg:border-r">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck className="h-4 w-4 text-sky-700" aria-hidden />Agent access</div>
                <p className="mt-2 text-sm leading-5 text-slate-600">{selectedAgent.purpose ?? "No purpose has been declared for this agent."}</p>
                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div><dt className="text-xs text-slate-500">Owner</dt><dd className="mt-1 font-medium text-slate-800">{selectedAgent.owner ?? "Not specified"}</dd></div>
                  <div><dt className="text-xs text-slate-500">Model</dt><dd className="mt-1 font-medium text-slate-800">{selectedAgent.model ?? "Not specified"}</dd></div>
                  <div><dt className="text-xs text-slate-500">Containment breaches</dt><dd className={cn("mt-1 font-medium", selectedAgent.breach_count > 0 ? "text-rose-700" : "text-slate-800")}>{selectedAgent.breach_count}</dd></div>
                  <div><dt className="text-xs text-slate-500">MCP access</dt><dd className="mt-1 font-medium text-slate-800">{selectedAgent.enabled == null ? "Not declared" : selectedAgent.enabled ? "Enabled" : "Disabled"}</dd></div>
                </dl>
                <div className="mt-5">
                  <p className="text-xs font-medium text-slate-500">Allowed tools</p>
                  {selectedAgent.allowed_tools.length ? <ul className="mt-2 flex flex-wrap gap-1.5">{selectedAgent.allowed_tools.map((tool) => <li key={tool} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700">{tool}</li>)}</ul> : <p className="mt-1 text-sm text-slate-500">No declared tool allowlist</p>}
                </div>
                {selectedAgent.github_repositories.length ? <div className="mt-4"><p className="text-xs font-medium text-slate-500">Declared repositories</p><ul className="mt-2 flex flex-wrap gap-1.5">{selectedAgent.github_repositories.map((repository) => <li key={repository} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700">{repository}</li>)}</ul></div> : null}
              </aside>

              <div className="min-w-0 px-5 py-5 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <div><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Activity className="h-4 w-4 text-slate-500" aria-hidden />Latest session evidence</div><p className="mt-1 text-xs text-slate-500">Tool names, timestamps, and evaluated outcomes. Sensitive arguments and outputs are not shown.</p></div>
                  {selectedAgent.last_session_id ? <span className="max-w-44 truncate font-mono text-[10px] text-slate-500" title={selectedAgent.last_session_id}>Session {selectedAgent.last_session_id}</span> : null}
                </div>
                {inventory.timelineLoading ? <p className="py-8 text-center text-sm text-slate-500" role="status">Loading tenant-checked session evidence…</p>
                  : inventory.timelineUnavailable ? <p className="mt-4 rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">Session evidence could not be loaded.</p>
                    : inventory.timeline.length ? <ol className="mt-4 divide-y divide-slate-100 border-y border-slate-200">{inventory.timeline.map((event) => <li key={event.id} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><p className="truncate font-mono text-xs font-medium text-slate-800">{event.tool_name}</p><p className="mt-1 truncate text-[11px] text-slate-500">{new Date(event.timestamp).toLocaleString()} · trace {event.trace_id.slice(0, 12)} · session {event.session_id.slice(0, 8)}</p></div><div className="flex items-center gap-2 text-[11px] text-slate-600"><span>{event.verdict ?? "Not evaluated"}</span>{typeof event.risk_score === "number" ? <span className="rounded bg-slate-100 px-1.5 py-0.5 tabular-nums">risk {Math.round(event.risk_score)}</span> : null}{event.recommended_action ? <span>{event.recommended_action}</span> : null}{event.post_exec_redacted ? <span className="text-slate-500">redacted</span> : null}</div></li>)}</ol>
                      : <div className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-7 text-center"><p className="text-sm font-medium text-slate-700">No tool-call evidence in the latest session</p><p className="mt-1 text-xs text-slate-500">Session activity will appear here when events are recorded.</p></div>}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
