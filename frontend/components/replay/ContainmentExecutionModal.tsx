"use client";

import { CheckCircle2, Loader2, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ActionState = "pending" | "confirmed" | "failed";

export function ContainmentExecutionModal({
  isOpen,
  onClose,
  actionType,
  agentId,
  sessionId,
  state,
  backendStatus,
  message,
}: {
  isOpen: boolean;
  onClose: () => void;
  actionType: "QUARANTINE" | "KILL" | null;
  agentId: string;
  sessionId: string;
  state: ActionState;
  backendStatus?: string | null;
  message?: string | null;
}) {
  if (!isOpen || !actionType) return null;

  const confirmed = state === "confirmed";
  const failed = state === "failed";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
      <section className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="containment-title">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500">Backend session action</p>
            <h2 id="containment-title" className="mt-1 text-base font-bold text-slate-950">
              {actionType === "KILL" ? "Kill session" : "Quarantine session"}
            </h2>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">Agent: {agentId || "—"} · Session: {sessionId || "—"}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="space-y-3 p-5">
          {state === "pending" && (
            <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900" role="status">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for the backend to confirm this action…
            </div>
          )}
          {confirmed && (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950" role="status">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Backend confirmed {actionType.toLowerCase()}.</p>
                <p className="mt-1">Session status: {backendStatus || "—"}</p>
              </div>
            </div>
          )}
          {failed && (
            <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950" role="alert">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">The action was not confirmed.</p>
                <p className="mt-1 break-words">{message || "The backend returned no confirmed action result."}</p>
              </div>
            </div>
          )}
        </div>

        <footer className="flex justify-end border-t border-slate-100 bg-slate-50 p-4">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </footer>
      </section>
    </div>
  );
}
