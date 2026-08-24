"use client";

import { cn } from "@/lib/utils";
import { categorizeTrajectoryAction, trajectoryActionTone } from "@/lib/replayTrajectory";

export interface TrajectoryStepView {
  index: number;
  turn: number;
  action: string;
  tool: string;
  risk: number;
  verdict: string;
}

export function ReplayTrajectoryStrip({
  steps,
  selectedIndex,
  onSelect,
}: {
  steps: TrajectoryStepView[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  if (steps.length === 0) return null;

  return (
    <div className="border-b border-border bg-muted/15 px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Attack trajectory</p>
        <p className="font-mono text-[10px] text-muted-foreground">{steps.length} turns</p>
      </div>
      <div className="mt-3 flex items-stretch gap-1 overflow-x-auto pb-1 scroll-smooth" role="list">
        {steps.map((step, i) => {
          const actionType = categorizeTrajectoryAction(step.tool, step.verdict);
          const selected = selectedIndex === step.index;
          return (
            <div key={step.index} className="flex items-center shrink-0">
              <button
                type="button"
                role="listitem"
                onClick={() => onSelect(step.index)}
                className={cn(
                  "interactive-pill flex min-w-[108px] flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-all duration-200",
                  trajectoryActionTone(actionType),
                  selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background shadow-sm"
                )}
                aria-current={selected ? "true" : undefined}
              >
                <span className="font-mono text-[10px] uppercase tracking-wide opacity-80">
                  Turn {step.turn}
                </span>
                <span className="truncate text-xs font-medium">{actionType}</span>
                <span className="truncate font-mono text-[10px] opacity-90">{step.tool}</span>
                <span className="font-mono text-sm font-semibold tabular-nums">{step.risk.toFixed(0)}</span>
              </button>
              {i < steps.length - 1 && (
                <div className="mx-0.5 h-px w-4 shrink-0 bg-border sm:w-6" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
