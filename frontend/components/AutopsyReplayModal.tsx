"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Microscope, RotateCcw, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskScore } from "@/components/shared/RiskScore";
import { fetchFromBackend } from "@/lib/api";
import type { ToolCallEvent } from "@/lib/types";

interface AutopsyReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
}

interface TimelineEvaluation {
  risk_score: number;
  verdict: string;
  confidence: number;
  recommended_action: string;
  flags: string[];
}

interface TimelineEntry {
  event: ToolCallEvent;
  evaluation?: TimelineEvaluation | null;
}

interface ForensicResult {
  total_events: number;
  recon_duration_turns: number;
  goal_drift_distance: number;
  privilege_escalation_detected: boolean;
  forensic_summary: string;
}

interface TrajectoryStep {
  turn: number;
  action: string;
  tool: string;
  risk: number;
  detail: string;
}

const RECON_TOOLS = ["list", "read", "search", "whoami", "getcwd", "stat", "glob"];
const ESCALATION_TOOLS = ["exec", "delete", "chmod", "sudo", "shell", "nc", "tunnel", "reverse", "bash"];

function categorizeAction(tool: string, verdict?: string | null): string {
  const t = tool.toLowerCase();
  if (verdict === "BREACHED") return "Sandbox Escape";
  if (ESCALATION_TOOLS.some((k) => t.includes(k))) return "Privilege Escalation";
  if (RECON_TOOLS.some((k) => t.includes(k))) return "Reconnaissance";
  return "Tool Execution";
}

function formatDetail(event: ToolCallEvent): string {
  const args = event.arguments ?? {};
  if (typeof args.payload === "string" && args.payload) return args.payload;
  if (event.response) {
    if (typeof event.response.text === "string" && event.response.text) return event.response.text;
    if (Object.keys(event.response).length > 0) return JSON.stringify(event.response, null, 2);
  }
  if (Object.keys(args).length > 0) return JSON.stringify(args, null, 2);
  return "No payload captured for this tool call.";
}

export default function AutopsyReplayModal({ isOpen, onClose, sessionId }: AutopsyReplayModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [trajectorySteps, setTrajectorySteps] = useState<TrajectoryStep[]>([]);
  const [forensics, setForensics] = useState<ForensicResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen || !sessionId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setForensics(null);

    const loadAutopsy = async () => {
      const rawTimeline = await fetchFromBackend<TimelineEntry[]>(
        `/api/v1/sessions/${sessionId}/timeline`,
        { silent: true }
      );

      if (cancelled) return;

      if (!rawTimeline || rawTimeline.length === 0) {
        setError("Could not retrieve timeline data for this session.");
        setTrajectorySteps([]);
        setLoading(false);
        return;
      }

      const timeline = rawTimeline;
      const steps: TrajectoryStep[] = timeline.map((entry, index) => ({
        turn: index + 1,
        action: categorizeAction(entry.event.tool_name, entry.evaluation?.verdict),
        tool: entry.event.tool_name,
        risk: entry.evaluation?.risk_score ?? 0,
        detail: formatDetail(entry.event),
      }));

      const events = timeline.map((t) => ({
        tool_name: t.event.tool_name,
        arguments: t.event.arguments,
        response: t.event.response,
        risk_score: t.evaluation?.risk_score,
        verdict: t.evaluation?.verdict,
      }));

      let result: ForensicResult | null = null;
      if (events.length) {
        result = await fetchFromBackend<ForensicResult>("/api/v1/forensics/analyze", {
          method: "POST",
          body: JSON.stringify({ events, session_id: sessionId }),
        });
      }

      if (cancelled) return;

      setTrajectorySteps(steps);
      setForensics(result);
      setCurrentStep(0);
      setLoading(false);
    };

    void loadAutopsy();

    return () => {
      cancelled = true;
    };
  }, [isOpen, sessionId]);

  // Autofocus the close button when the dialog opens (simple focus trap entry point).
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Close the dialog on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const step = trajectorySteps[currentStep];
  const hasContent = trajectorySteps.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" role="presentation" onClick={onClose}>
      <div
        className="w-full max-w-3xl space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Autopsy replay"
        aria-busy={loading}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-rose-600">
              <ShieldAlert className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="font-mono text-base font-bold text-slate-900">Autopsy Mode — Trajectory Replay</h2>
              <p className="text-xs text-slate-500">Step-by-step forensic analysis of agent escalation</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close autopsy replay" ref={closeButtonRef} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden />
            <p className="font-mono text-xs">Loading trajectory &amp; forensics…</p>
          </div>
        ) : error || !hasContent ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <ShieldAlert className="h-6 w-6 text-rose-500" aria-hidden />
            <p className="text-sm text-slate-700">{error ?? "No trajectory data available for this session."}</p>
            <Button variant="outline" size="sm" onClick={onClose} className="border-slate-200">
              Close
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between font-mono text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                Step {currentStep + 1} of {trajectorySteps.length}
              </span>
              <RiskScore score={step.risk} />
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between">
                <Badge variant="info" className="font-mono text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                  Turn {step.turn}: {step.action}
                </Badge>
                <span className="font-mono text-xs font-semibold text-rose-600">Tool: {step.tool}</span>
              </div>
              <pre className="rounded-lg border border-slate-800 bg-[#0a0f1d] p-3.5 font-mono text-xs leading-relaxed text-slate-200 overflow-x-auto select-text">{step.detail}</pre>
            </div>

            {forensics && (
              <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
                <div className="flex items-center gap-2">
                  <Microscope className="h-4 w-4 text-slate-600" aria-hidden />
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700">
                    Forensic Autopsy Diagnostics
                  </h3>
                  {forensics.privilege_escalation_detected && (
                    <Badge variant="critical" className="font-mono text-[10px]">
                      Escalation detected
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200/80 bg-white p-3 text-center shadow-2xs">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Recon turns</p>
                    <p className="mt-1 font-mono text-xl font-bold text-slate-900">{forensics.recon_duration_turns}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200/80 bg-white p-3 text-center shadow-2xs">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Goal drift</p>
                    <p className="mt-1 font-mono text-xl font-bold text-slate-900">{forensics.goal_drift_distance.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200/80 bg-white p-3 text-center shadow-2xs">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Events</p>
                    <p className="mt-1 font-mono text-xl font-bold text-slate-900">{forensics.total_events}</p>
                  </div>
                </div>
                <p className="rounded-lg border border-slate-200/80 bg-white p-3 font-mono text-xs leading-relaxed text-slate-700 shadow-2xs">
                  {forensics.forensic_summary}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={currentStep === 0} onClick={() => setCurrentStep((s) => s - 1)} className="border-slate-200 text-xs">
                  Previous
                </Button>
                <Button size="sm" disabled={currentStep === trajectorySteps.length - 1} onClick={() => setCurrentStep((s) => s + 1)} className="text-xs">
                  Next
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="gap-1.5 font-mono text-xs text-slate-600 hover:text-slate-900" onClick={() => setCurrentStep(0)}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Restart
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
