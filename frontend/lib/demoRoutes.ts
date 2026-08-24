/** Public interactive demo — no auth required. */

export type DemoTab = "guard" | "redteam" | "findings" | "replay" | "command" | "pipeline";

export function demoHref(tab: DemoTab = "guard"): string {
  return `/demo?tab=${tab}`;
}

export const DEMO_TAB_LABELS: Record<DemoTab, string> = {
  guard: "Guard playground",
  redteam: "Red team scan",
  findings: "Findings",
  replay: "Session replay",
  command: "Command center",
  pipeline: "Agent pipeline",
};
