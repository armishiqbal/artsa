"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import {
  READINESS_PHASE_META,
  type ReadinessPhase,
} from "@/lib/readinessFlow";
import { cn } from "@/lib/utils";

const ORDER: ReadinessPhase[] = ["validate", "ingest", "confirm"];

export function ReadinessPhaseStrip({
  phase,
  suiteComplete,
  ingestDone,
  trafficConfirmed,
  loading,
}: {
  phase: ReadinessPhase;
  suiteComplete: boolean;
  ingestDone: boolean;
  trafficConfirmed: boolean;
  loading?: boolean;
}) {
  const doneFor = (p: ReadinessPhase): boolean => {
    if (p === "validate") return suiteComplete;
    if (p === "ingest") return ingestDone;
    return trafficConfirmed || phase === "complete";
  };

  const activeFor = (p: ReadinessPhase): boolean => {
    if (phase === "complete") return false;
    return phase === p;
  };

  return (
    <nav aria-label="Setup progress" className="surface-panel p-4 sm:p-5">
      <ol className="grid gap-4 sm:grid-cols-3">
        {ORDER.map((p, index) => {
          const meta = READINESS_PHASE_META[p];
          const done = doneFor(p);
          const active = activeFor(p);
          const href = `#phase-${p}`;

          return (
            <li key={p} className="relative">
              {index > 0 && (
                <span
                  className="absolute -left-2 top-4 hidden h-px w-4 bg-border sm:block"
                  aria-hidden
                />
              )}
              <Link
                href={href}
                className={cn(
                  "flex gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                  active && "border-foreground/20 bg-muted/40",
                  done && !active && "border-border bg-muted/30",
                  !active && !done && "border-border bg-muted/10 hover:bg-muted/20"
                )}
              >
                <span className="mt-0.5 shrink-0">
                  {loading && active ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
                  ) : done ? (
                    <CheckCircle2 className="h-5 w-5 text-foreground" aria-hidden />
                  ) : (
                    <Circle
                      className={cn(
                        "h-5 w-5",
                        active ? "text-foreground" : "text-muted-foreground"
                      )}
                      aria-hidden
                    />
                  )}
                </span>
                <span className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Step {meta.step}
                  </p>
                  <p className="text-sm font-medium">{meta.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
