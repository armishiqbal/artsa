/** Red Team v2 navigation — security-testing IA. */

export type RedTeamNavGroup = {
  label: string;
  items: { name: string; href: string; exact?: boolean }[];
};

export const redTeamNav: RedTeamNavGroup[] = [
  {
    label: "Red Team",
    items: [
      { name: "Attack Lab", href: "/red-team/lab" },
      { name: "Campaigns", href: "/red-team/campaigns" },
      { name: "Live Monitor", href: "/red-team/monitor", exact: true },
      { name: "AI Activity", href: "/red-team/monitor/live" },
      { name: "Attack Graph", href: "/red-team/graph" },
    ],
  },
  {
    label: "Findings",
    items: [
      { name: "Findings", href: "/red-team/findings" },
      { name: "Evidence", href: "/red-team/evidence" },
    ],
  },
  {
    label: "Analysis",
    items: [
      { name: "Coverage", href: "/red-team/coverage" },
      { name: "Attack Surface", href: "/red-team/surface" },
      { name: "Result Matrix", href: "/red-team/matrix" },
    ],
  },
  {
    label: "Assets",
    items: [
      { name: "Scoring & Judges", href: "/red-team/scoring" },
      { name: "Targets", href: "/red-team/targets" },
      { name: "Library", href: "/red-team/library" },
    ],
  },
  {
    label: "Reports",
    items: [
      { name: "Reports", href: "/reports?module=red-team" },
      { name: "Research", href: "/red-team/research" },
    ],
  },
];

export function isRedTeamHrefActive(pathname: string, href: string, exact?: boolean): boolean {
  const pathOnly = href.split("?")[0];
  if (exact || pathOnly === "/red-team") return pathname === pathOnly;
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}

export type LiveChromeState =
  | "connecting"
  | "live"
  | "paused"
  | "stalled"
  | "ended"
  | "error"
  | "idle";
