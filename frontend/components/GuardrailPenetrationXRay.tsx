"use client";

import { ShieldCheck, ShieldAlert, AlertTriangle, Layers } from 'lucide-react';

interface GuardrailPenetrationXRayProps {
  bypassDepth: number; // 0 to 4
}

const layers = [
  { depth: 0, name: "Input Filter", desc: "Keyword, Regex & Inappropriate Content Scan" },
  { depth: 1, name: "System Prompt", desc: "Context Safety & System Rules Enforcement" },
  { depth: 2, name: "RAG Retrieval", desc: "Vector Database Context & Grounding Check" },
  { depth: 3, name: "LLM Generation", desc: "Model Safety Alignment & Policy Check" },
  { depth: 4, name: "Output Filter", desc: "Toxicity, PII & Code Integrity Sanitization" },
];

export default function GuardrailPenetrationXRay({ bypassDepth }: GuardrailPenetrationXRayProps) {
  return (
    <div className="ui-panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-600" />
          Defense Depth Penetration X-Ray
        </h3>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
          Bypass Depth: <strong className={bypassDepth > 2 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>{bypassDepth}/4</strong>
        </span>
      </div>

      <div className="relative space-y-2.5">
        {layers.map((layer) => {
          const isPenetrated = layer.depth <= bypassDepth && bypassDepth > 0;
          const isStopPoint = layer.depth === bypassDepth;

          return (
            <div 
              key={layer.depth}
              className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                isStopPoint && bypassDepth > 0
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : isPenetrated
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-slate-50/70 border-slate-200/80 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  isStopPoint && bypassDepth > 0
                    ? 'bg-rose-100 text-rose-700'
                    : isPenetrated
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {isStopPoint && bypassDepth > 0 ? (
                    <ShieldAlert className="w-4 h-4" />
                  ) : isPenetrated ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Layer {layer.depth}: {layer.name}
                  </div>
                  <div className="text-xs text-slate-500">{layer.desc}</div>
                </div>
              </div>

              <span className={`text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full ${
                isStopPoint && bypassDepth > 0
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : isPenetrated
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                {isStopPoint && bypassDepth > 0 ? 'Penetrated' : isPenetrated ? 'Bypassed' : 'Protected'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
