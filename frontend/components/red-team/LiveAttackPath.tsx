"use client";

import { cn } from "@/lib/utils";
import type { AttackPathNodeId } from "@/lib/liveMonitorSecurity";

type PathNode = {
  id: AttackPathNodeId;
  label: string;
  active: boolean;
  detail: string;
};

/** Horizontal attack path — nodes light as the selected round progresses. */
export function LiveAttackPath({
  nodes,
  selectedId,
  onSelect,
  className,
}: {
  nodes: PathNode[];
  selectedId?: AttackPathNodeId | null;
  onSelect?: (id: AttackPathNodeId) => void;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-border p-3", className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Attack path
      </h3>
      <div className="mt-3 flex flex-wrap items-stretch gap-1 sm:flex-nowrap">
        {nodes.map((node, i) => (
          <div key={node.id} className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              onClick={() => onSelect?.(node.id)}
              className={cn(
                "w-full rounded-md border px-2 py-2 text-left transition-colors",
                node.active
                  ? "border-foreground/25 bg-muted/50"
                  : "border-border/60 bg-transparent opacity-50",
                selectedId === node.id && "ring-1 ring-foreground/40"
              )}
              aria-pressed={selectedId === node.id}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {node.label}
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-foreground">
                {node.detail}
              </p>
            </button>
            {i < nodes.length - 1 ? (
              <span className="hidden shrink-0 text-muted-foreground sm:inline" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
