"use client";

import { useState } from "react";
import { Check, Copy, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TimelineEntry } from "@/lib/types/replay";
import { formatDateTime } from "@/lib/dates";

type DrawerTab = "payload" | "identity" | "evaluation";

function formatRecord(value: unknown): string {
  if (value == null) return "No backend record.";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ActivityEventDrawer({
  isOpen,
  onClose,
  entry,
  onQuarantine,
  onKill,
}: {
  isOpen: boolean;
  onClose: () => void;
  entry: TimelineEntry | null;
  onQuarantine: () => void;
  onKill: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>("payload");

  if (!isOpen || !entry) return null;

  const { event, evaluation } = entry;
  const risk =
    typeof evaluation?.risk_score === "number" && Number.isFinite(evaluation.risk_score)
      ? evaluation.risk_score
      : null;
  const verdict = typeof evaluation?.verdict === "string" ? evaluation.verdict : "UNCLASSIFIED";
  const copy = async (key: string, value: unknown) => {
    try {
      await navigator.clipboard.writeText(formatRecord(value));
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  const tabs: Array<{ id: DrawerTab; label: string }> = [
    { id: "payload", label: "Payload" },
    { id: "identity", label: "Session identity" },
    { id: "evaluation", label: "Evaluation" },
  ];

  const Evidence = ({ title, value, copyKey }: { title: string; value: unknown; copyKey: string }) => (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
        <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => void copy(copyKey, value)}>
          {copied === copyKey ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied === copyKey ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100">
        {formatRecord(value)}
      </pre>
    </section>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="presentation">
      <button className="absolute inset-0 bg-slate-900/40" aria-label="Close event evidence" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-slate-50 shadow-2xl" role="dialog" aria-modal="true" aria-label="Backend activity event evidence">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {verdict === "BREACHED" && <ShieldAlert className="h-4 w-4 text-rose-600" />}
              <span className="rounded border border-slate-200 px-2 py-1 font-mono text-xs font-semibold text-slate-800">
                {verdict}
              </span>
              <span className="rounded border border-slate-200 px-2 py-1 font-mono text-xs text-slate-700">
                Risk: {risk == null ? "—" : String(risk) + "/100"}
              </span>
            </div>
            <h2 className="mt-2 truncate font-mono text-lg font-bold text-slate-950">{event.tool_name}</h2>
            <p className="mt-1 font-mono text-xs text-slate-500">
              Event: {event.id || "—"} · Trace: {event.trace_id || "—"} · {formatDateTime(event.timestamp)}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <nav className="flex gap-1 border-b border-slate-200 bg-white px-5 pt-2" aria-label="Event evidence sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={activeTab === tab.id ? "border-b-2 border-slate-900 px-3 py-2 text-xs font-semibold text-slate-900" : "border-b-2 border-transparent px-3 py-2 text-xs text-slate-500"}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {activeTab === "payload" && (
            <>
              <Evidence title="Recorded tool arguments" value={event.arguments} copyKey="arguments" />
              <Evidence title="Recorded response" value={event.response} copyKey="response" />
            </>
          )}
          {activeTab === "identity" && (
            <Evidence title="Recorded session identity" value={{ session_id: event.session_id, agent_id: event.agent_id }} copyKey="identity" />
          )}
          {activeTab === "evaluation" && (
            <>
              {typeof evaluation?.reasoning === "string" && (
                <section className="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-700">Recorded rationale</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{evaluation.reasoning}</p>
                </section>
              )}
              <Evidence title="Backend evaluation record" value={evaluation ?? null} copyKey="evaluation" />
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white p-4">
          <span className="font-mono text-xs text-slate-500">Session: {event.session_id || "—"}</span>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!event.session_id} onClick={onQuarantine}>Quarantine session</Button>
            <Button type="button" size="sm" variant="destructive" disabled={!event.session_id} onClick={onKill}>Kill session</Button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
