import {
  LayoutDashboard,
  Network,
  Users,
  Shield,
  Crosshair,
  Settings2,
  GitBranch,
  FileSearch,
  ScrollText,
  FlaskConical,
  Radio,
  Bot,
  Plug,
  KeyRound,
  Cpu,
  Target,
  History,
  Compass,
  Swords,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  kind: "link";
  name: string;
  href: string;
  icon: LucideIcon;
  capability?: keyof import("@/lib/hooks/useAuthRole").AuthCapabilities;
  exact?: boolean;
  adminOnly?: boolean;
}

export interface NavGroup {
  kind: "group";
  id: "discover" | "red-team" | "settings";
  name: string;
  icon: LucideIcon;
  children: NavLink[];
  adminOnly?: boolean;
}

export type NavItem = NavLink | NavGroup;

export interface NavSection {
  label: string;
  items: NavItem[];
}

export function isNavHrefActive(pathname: string, href: string, exact?: boolean): boolean {
  const pathOnly = href.split("?")[0] ?? href;
  if (pathname === pathOnly) return true;
  if (exact) return false;
  if (
    pathOnly === "/command-center" ||
    pathOnly === "/get-started" ||
    pathOnly === "/settings" ||
    pathOnly === "/red-team"
  ) {
    return false;
  }
  return pathname.startsWith(`${pathOnly}/`);
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.kind === "link") return isNavHrefActive(pathname, item.href, item.exact);
  return item.children.some((child) => isNavHrefActive(pathname, child.href, child.exact));
}

/** Leaf navigation entries for command search and route smoke tests. */
export function flattenNavItems(items: NavItem[]): NavLink[] {
  return items.flatMap((item) => (item.kind === "group" ? item.children : [item]));
}

export function filterNavItemsByAccess(
  items: NavItem[],
  capabilities: import("@/lib/hooks/useAuthRole").AuthCapabilities,
  isAdmin: boolean
): NavItem[] {
  return items
    .map((item): NavItem | null => {
      if (item.adminOnly && !isAdmin) return null;
      if (item.kind === "link") {
        if (item.capability && !capabilities[item.capability]) return null;
        return item;
      }
      const children = filterNavItemsByAccess(item.children, capabilities, isAdmin) as NavLink[];
      return children.length ? { ...item, children } : null;
    })
    .filter((item): item is NavItem => item !== null);
}

export const primaryNavItems: NavItem[] = [
  { kind: "link", name: "Command Center", href: "/command-center", icon: LayoutDashboard, exact: true },
  { kind: "link", name: "AI Security Playground", href: "/playground", icon: Shield },
  { kind: "link", name: "Findings", href: "/findings", icon: FileSearch },
  { kind: "link", name: "Activity", href: "/logs", icon: ScrollText },
  { kind: "link", name: "Sessions", href: "/replay", icon: History },
  {
    kind: "group",
    id: "discover",
    name: "Discover",
    icon: Compass,
    children: [
      { kind: "link", name: "Targets", href: "/targets", icon: Target, exact: true },
      { kind: "link", name: "AI Assets", href: "/pipeline", icon: GitBranch },
      { kind: "link", name: "Agents", href: "/mission-graph", icon: Bot },
      { kind: "link", name: "Connections", href: "/command-center/topology", icon: Network },
    ],
  },
  {
    kind: "group",
    id: "red-team",
    name: "Red Team",
    icon: Swords,
    children: [
      { kind: "link", name: "Attack Lab", href: "/red-team/lab", icon: Crosshair, capability: "can_run_campaigns" },
      { kind: "link", name: "Campaigns", href: "/red-team/campaigns", icon: FlaskConical, capability: "can_run_campaigns" },
      { kind: "link", name: "Detections", href: "/red-team/monitor", icon: Radio, capability: "can_run_campaigns" },
    ],
  },
  {
    kind: "group",
    id: "settings",
    name: "Settings",
    icon: Settings2,
    adminOnly: true,
    children: [
      { kind: "link", name: "Settings", href: "/settings", icon: Settings2, exact: true },
      { kind: "link", name: "Integrations", href: "/settings/integrations", icon: Plug, capability: "can_manage_integrations" },
      { kind: "link", name: "AI Providers", href: "/admin/providers", icon: Cpu, capability: "can_manage_providers" },
      { kind: "link", name: "API Keys", href: "/get-started", icon: KeyRound, exact: true },
      { kind: "link", name: "Team & Access", href: "/settings/team", icon: Users },
      { kind: "link", name: "Policies", href: "/admin/policies", icon: Shield, capability: "can_manage_policies" },
    ],
  },
];

/** Compatibility wrapper for existing route smoke tests and consumers. */
export const navSections: NavSection[] = [{ label: "", items: primaryNavItems }];
