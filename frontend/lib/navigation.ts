import {
  LayoutDashboard,
  Activity,
  Network,
  Swords,
  Database,
  FileText,
  Users,
  Shield,
  ShieldAlert,
  Crosshair,
  Rocket,
  Settings2,
  BarChart3,
  GitBranch,
  FileSearch,
  ScrollText,
  FlaskConical,
  Radio,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  capability?: keyof import("@/lib/hooks/useAuthRole").AuthCapabilities;
  /** Nested items — parent href remains the default landing route. */
  children?: NavItem[];
  /** When true, only exact pathname match counts as active (no prefix). */
  exact?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
}

export function isNavHrefActive(pathname: string, href: string, exact?: boolean): boolean {
  const pathOnly = href.split("?")[0] ?? href;
  if (pathname === pathOnly) return true;
  if (exact) return false;

  // Exact-only hubs that have sibling child routes under the same prefix.
  if (
    pathOnly === "/dashboard" ||
    pathOnly === "/get-started" ||
    pathOnly === "/red-team" ||
    pathOnly === "/campaigns" ||
    pathOnly === "/red-team/monitor"
  ) {
    // Live Monitor owns campaign theaters (/monitor/:id) but not AI Activity (/monitor/live).
    if (pathOnly === "/red-team/monitor") {
      return (
        pathname.startsWith("/red-team/monitor/") &&
        !pathname.startsWith("/red-team/monitor/live")
      );
    }
    return false;
  }
  return pathname.startsWith(`${pathOnly}/`);
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (isNavHrefActive(pathname, item.href, item.exact)) return true;
  return item.children?.some((child) => isNavHrefActive(pathname, child.href, child.exact)) ?? false;
}

/** Leaf nav entries for command palette, smoke tests, etc. */
export function flattenNavItems(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => (item.children?.length ? item.children : [item]));
}

export function filterNavItemsByCapability(
  items: NavItem[],
  capabilities: import("@/lib/hooks/useAuthRole").AuthCapabilities
): NavItem[] {
  return items
    .map((item) => {
      if (item.children?.length) {
        const children = filterNavItemsByCapability(item.children, capabilities);
        if (children.length === 0) return null;
        return { ...item, children };
      }
      if (item.capability && !capabilities[item.capability]) return null;
      return item;
    })
    .filter((item): item is NavItem => item != null);
}

export const navSections: NavSection[] = [
  {
    label: "Get Started",
    items: [{ name: "Get Started", href: "/get-started", icon: Rocket }],
  },
  {
    label: "Protect",
    items: [
      { name: "Command Center", href: "/dashboard", icon: LayoutDashboard },
      { name: "Agent Pipeline", href: "/pipeline", icon: GitBranch },
      { name: "Analytics", href: "/analytics", icon: BarChart3 },
      { name: "Logs", href: "/logs", icon: ScrollText },
      { name: "Topology", href: "/dashboard/topology", icon: Network },
    ],
  },
  {
    label: "Test",
    items: [
      {
        name: "Red Team",
        href: "/red-team",
        icon: Swords,
        capability: "can_run_campaigns",
        children: [
          {
            name: "Try a message",
            href: "/red-team/lab",
            icon: Crosshair,
            capability: "can_run_campaigns",
          },
          {
            name: "Safety tests",
            href: "/red-team/campaigns",
            icon: FlaskConical,
            capability: "can_run_campaigns",
          },
          {
            name: "Live results",
            href: "/red-team/monitor",
            icon: Radio,
            capability: "can_run_campaigns",
          },
          {
            name: "Activity",
            href: "/red-team/monitor/live",
            icon: Activity,
            capability: "can_run_campaigns",
          },
          {
            name: "Outcomes",
            href: "/red-team/matrix",
            icon: BarChart3,
            capability: "can_run_campaigns",
          },
          {
            name: "Attack Graph",
            href: "/red-team/graph",
            icon: Waypoints,
            capability: "can_run_campaigns",
          },
        ],
      },
      { name: "Guard capabilities", href: "/guides/guard-capabilities", icon: Shield },
      { name: "RAG Scanner", href: "/rag-scanner", icon: Database },
    ],
  },
  {
    label: "Investigate",
    items: [
      { name: "Findings", href: "/findings", icon: FileSearch },
      { name: "Agentic Risks", href: "/risks", icon: ShieldAlert },
      { name: "Reports", href: "/reports", icon: FileText },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [
      { name: "Admin Overview", href: "/admin", icon: Shield },
      { name: "Settings", href: "/settings", icon: Settings2 },
      { name: "Providers", href: "/admin/providers", icon: Users, capability: "can_manage_providers" },
      { name: "Policies", href: "/admin/policies", icon: Shield, capability: "can_manage_policies" },
      { name: "Alerts & Integrations", href: "/admin/alerts", icon: Activity },
      { name: "System & Keys", href: "/admin/system", icon: FileText },
    ],
  },
];
