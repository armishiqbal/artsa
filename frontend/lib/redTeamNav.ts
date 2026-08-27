/** Red Team workspace rail — core workflow only. */

export type RedTeamNavGroup = {
  label: string;
  items: { name: string; href: string; exact?: boolean }[];
};

/** Subfolders: Run → lab/campaigns, Watch → monitor/activity. Reports live in main app nav. */
export const redTeamNav: RedTeamNavGroup[] = [
  {
    label: "Test",
    items: [
      { name: "Try a message", href: "/red-team/lab" },
      { name: "Safety tests", href: "/red-team/campaigns" },
    ],
  },
  {
    label: "Watch",
    items: [
      { name: "Live results", href: "/red-team/monitor", exact: true },
      { name: "Activity", href: "/red-team/monitor/live" },
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
