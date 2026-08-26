"use client";

import { cn } from "@/lib/utils";
import type { AssessmentTestRow } from "@/lib/assessmentResults";

interface AssessmentTestTableProps {
  rows: AssessmentTestRow[];
  selectedId?: string | null;
  onSelect?: (row: AssessmentTestRow) => void;
  className?: string;
}

export function AssessmentTestTable({
  rows,
  selectedId,
  onSelect,
  className,
}: AssessmentTestTableProps) {
  if (!rows.length) {
    return (
      <p className="py-10 text-center text-[13px] text-[#7c7c7c]">No tests run yet.</p>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-[12px]">
        <thead className="border-b border-[#313131] bg-[#141414] font-mono text-[10px] uppercase tracking-[0.08em] text-[#7c7c7c]">
          <tr>
            <th className="px-3 py-2.5 font-medium">Round</th>
            <th className="px-3 py-2.5 font-medium">Test</th>
            <th className="px-3 py-2.5 font-medium">Lens</th>
            <th className="px-3 py-2.5 font-medium">Score</th>
            <th className="px-3 py-2.5 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = selectedId === row.id;
            return (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-[#313131]/60 transition-colors",
                  onSelect && "cursor-pointer hover:bg-[#1a1a1a]",
                  selected && "bg-[#1a1f2e]"
                )}
                onClick={() => onSelect?.(row)}
              >
                <td className="px-3 py-2.5 font-mono tabular-nums text-[#a7a7a7]">
                  R{row.roundNumber}
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-white">{row.name}</p>
                  <p className="font-mono text-[10px] text-[#7c7c7c]">
                    {row.asiCode ?? (row.category || "—")}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-[#a7a7a7]">{row.lens}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums text-white">
                  {row.score05}/5
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase",
                      row.harmful
                        ? "text-[hsl(var(--severity-critical))]"
                        : "text-[#4ade80]"
                    )}
                  >
                    {row.harmful ? "Harmful" : "Safe"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
