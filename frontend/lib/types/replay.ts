import type { ToolCallEvent } from "@/lib/types";

export interface TimelineEntry {
  event: ToolCallEvent;
  evaluation?: Record<string, unknown> | null;
}

export interface FallbackForensics {
  forensic_summary: string;
  privilege_escalation_detected: boolean;
  recon_duration_turns: number;
  goal_drift_distance: number;
  total_events: number;
}
