"use client";

import { ShieldCheck, ShieldAlert, AlertTriangle, Layers } from "lucide-react";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface GuardrailPenetrationXRayProps {
  bypassDepth: number;
}

const layers = [
  { depth: 0, name: "Input Filter", desc: "Keyword, regex & content scan" },
  { depth: 1, name: "System Prompt", desc: "Context safety enforcement" },
  { depth: 2, name: "RAG Retrieval", desc: "Vector grounding check" },
  { depth: 3, name: "LLM Generation", desc: "Model alignment policy" },
  { depth: 4, name: "Output Filter", desc: "PII & toxicity sanitization" },
];

export default function GuardrailPenetrationXRay({ bypassDepth }: GuardrailPenetrationXRayProps) {
  return (
    <DashboardCard
      title="Penetration X-Ray"
      description="Defense layer bypass visualization"
      badge={
        <Badge variant={bypassDepth > 2 ? "critical" : "success"} className="font-mono">
          Depth {bypassDepth}/4
        </Badge>
      }
    >
      <div className="space-y-2">
        {layers.map((layer) => {
          const isPenetrated = layer.depth <= bypassDepth && bypassDepth > 0;
          const isStopPoint = layer.depth === bypassDepth;

          return (
            <div
              key={layer.depth}
              className={cn(
                "flex items-center justify-between rounded-lg border px-4 py-3 transition-colors",
                isStopPoint && bypassDepth > 0 && "border-destructive/40 bg-destructive/5",
                isPenetrated && !isStopPoint && "border-severity-medium/30 bg-severity-medium/5",
                !isPenetrated && "border-border bg-muted/20"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    isStopPoint && bypassDepth > 0 && "bg-destructive/15 text-destructive",
                    isPenetrated && !isStopPoint && "bg-severity-medium/15 text-severity-medium",
                    !isPenetrated && "bg-emerald-500/15 text-emerald-400"
                  )}
                >
                  {isStopPoint && bypassDepth > 0 ? (
                    <ShieldAlert className="h-4 w-4" aria-hidden />
                  ) : isPenetrated ? (
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                  ) : (
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Layer {layer.depth}: {layer.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{layer.desc}</p>
                </div>
              </div>
              <Badge
                variant={isStopPoint && bypassDepth > 0 ? "critical" : isPenetrated ? "warning" : "success"}
                className="text-[10px] uppercase"
              >
                {isStopPoint && bypassDepth > 0 ? "Penetrated" : isPenetrated ? "Bypassed" : "Protected"}
              </Badge>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
