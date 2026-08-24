"use client";

import { ReplayRiskStrip, type TimelineEntryView } from "@/components/replay/ReplayTimeline";
import { ReplayTrajectoryStrip, type TrajectoryStepView } from "@/components/replay/ReplayTrajectoryStrip";

/** Unified scrubber — risk waveform + turn storyboard in one cinematic strip. */
export function ReplayFilmTimeline({
  entries,
  steps,
  selectedIndex,
  onSelect,
}: {
  entries: TimelineEntryView[];
  steps: TrajectoryStepView[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="border-b border-border bg-[hsl(var(--foreground)/0.02)]">
      <ReplayRiskStrip entries={entries} selectedIndex={selectedIndex} onSelect={onSelect} />
      <ReplayTrajectoryStrip steps={steps} selectedIndex={selectedIndex} onSelect={onSelect} />
      <p className="px-4 pb-3 text-[10px] text-muted-foreground sm:px-5">
        Click a bar or turn · Arrow keys · Space to play
      </p>
    </div>
  );
}
