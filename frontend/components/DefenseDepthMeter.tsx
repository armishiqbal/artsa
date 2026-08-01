"use client";

import { ShieldCheck, ShieldAlert, AlertTriangle, Layers } from 'lucide-react';

interface DefenseDepthMeterProps {
  bypassDepth: number; // 0 to 4
  totalLayers?: number;
}

const layers = [
  { depth: 0, name: "Input Filter", desc: "Keyword & Injection Filter" },
  { depth: 1, name: "System Prompt", desc: "Context Rules Enforcement" },
  { depth: 2, name: "RAG Retrieval", desc: "Context Vector Grounding" },
  { depth: 3, name: "LLM Generation", desc: "Model Safety Alignment" },
  { depth: 4, name: "Output Filter", desc: "PII & Harm Sanitization" },
];

export default function DefenseDepthMeter({ bypassDepth, totalLayers = 5 }: DefenseDepthMeterProps) {
  return (
    <div className="soc-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-soc-text flex items-center gap-2">
            <Layers className="w-4 h-4 text-soc-accent" />
            Defense Depth Meter
          </h3>
          <p className="text-xs text-soc-muted mt-0.5">
            5-Layer Segmented Defense Stack Penetration Diagnostic
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
            bypassDepth >= 3 ? 'badge-critical' : bypassDepth >= 1 ? 'badge-high' : 'badge-low'
          }`}>
            Depth: {bypassDepth} / 4
          </span>
        </div>
      </div>

      {/* Segmented Horizontal Bar */}
      <div className="grid grid-cols-5 gap-1.5">
        {layers.map((layer) => {
          const isPenetrated = layer.depth <= bypassDepth && bypassDepth > 0;
          const isStopPoint = layer.depth === bypassDepth;

          return (
            <div
              key={layer.depth}
              className={`h-3 rounded-md transition-all ${
                isStopPoint && bypassDepth > 0
                  ? 'bg-soc-critical shadow-critical animate-pulse'
                  : isPenetrated
                  ? 'bg-soc-high'
                  : 'bg-soc-low'
              }`}
              title={`Layer ${layer.depth}: ${layer.name} (${isPenetrated ? 'BREACHED' : 'PROTECTED'})`}
            />
          );
        })}
      </div>

      {/* Layer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 pt-1">
        {layers.map((layer) => {
          const isPenetrated = layer.depth <= bypassDepth && bypassDepth > 0;
          const isStopPoint = layer.depth === bypassDepth;

          return (
            <div
              key={layer.depth}
              className={`p-2.5 rounded-lg border text-xs transition ${
                isStopPoint && bypassDepth > 0
                  ? 'bg-soc-critical/10 border-soc-critical/40 text-soc-critical'
                  : isPenetrated
                  ? 'bg-soc-high/10 border-soc-high/40 text-soc-high'
                  : 'bg-soc-elevated/50 border-soc-border text-soc-muted'
              }`}
            >
              <div className="font-bold flex items-center justify-between text-[11px]">
                <span>L{layer.depth}</span>
                {isPenetrated ? <ShieldAlert className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5 text-soc-low" />}
              </div>
              <div className="font-bold text-soc-text text-[11px] truncate mt-1">{layer.name}</div>
              <div className="text-[10px] text-soc-muted truncate">{isPenetrated ? 'BREACHED' : 'PROTECTED'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
