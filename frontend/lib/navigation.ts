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
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  capability?: keyof import("@/lib/hooks/useAuthRole").AuthCapabilities;
  /** Nested items — parent href remains the default landing route. */
  children?: NavItem[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
}

export function isNavHrefActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Exact-only for hubs that have sibling child routes under the same prefix.
  if (
    href === "/dashboard" ||
    href === "/get-started" ||
    href === "/red-team" ||
    href === "/campaigns"
  ) {
    return false;
  }
  return pathname.startsWith(`${href}/`);
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (isNavHrefActive(pathname, item.href)) return true;
  return item.children?.some((child) => isNavHrefActive(pathname, child.href)) ?? false;
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
            name: "Attack Lab",
            href: "/red-team/lab",
            icon: Crosshair,
            capability: "can_run_campaigns",
          },
          {
            name: "Campaigns",
            href: "/red-team/campaigns",
            icon: FlaskConical,
            capability: "can_run_campaigns",
          },
          {
            name: "Live Monitor",
            href: "/red-team/monitor",
            icon: Activity,
            capability: "can_run_campaigns",
          },
          {
            name: "AI Activity",
            href: "/red-team/monitor/live",
            icon: Activity,
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
