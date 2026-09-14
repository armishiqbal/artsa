import {
  BarChart3,
  FileSearch,
  FileText,
  ShieldAlert,
  Target,
  Waypoints,
  Swords,
  Bot,
  Github,
  ShieldCheck,
} from "lucide-react";
import {
  filterNavItemsByAccess,
  flattenNavItems,
  primaryNavItems,
  type NavItem,
  type NavLink,
} from "@/lib/navigation";
import type { AuthCapabilities } from "@/lib/hooks/useAuthRole";

export interface CommandPaletteRoute extends NavLink {
  category: string;
}

export const secondaryCommandRoutes: CommandPaletteRoute[] = [
  { kind: "link", name: "Risk", href: "/risks", icon: ShieldAlert, category: "Assess" },
  { kind: "link", name: "Attack Surface", href: "/red-team/surface", icon: Target, category: "Assess", capability: "can_run_campaigns" },
  { kind: "link", name: "Red Team Overview", href: "/red-team", icon: Swords, category: "Red Team", exact: true, capability: "can_run_campaigns" },
  { kind: "link", name: "Attack Library", href: "/red-team/library", icon: FileSearch, category: "Red Team", capability: "can_run_campaigns" },
  { kind: "link", name: "Outcomes", href: "/red-team/matrix", icon: BarChart3, category: "Detect", capability: "can_run_campaigns" },
  { kind: "link", name: "Attack Graph", href: "/red-team/graph", icon: Waypoints, category: "Investigate", capability: "can_run_campaigns" },
  { kind: "link", name: "Reports", href: "/reports", icon: FileText, category: "Report" },
  { kind: "link", name: "Approvals", href: "/approvals", icon: ShieldCheck, category: "Runtime" },
  { kind: "link", name: "Investigations", href: "/investigations", icon: FileSearch, category: "Runtime" },
  { kind: "link", name: "Managed Agents", href: "/agents", icon: Bot, category: "Runtime", adminOnly: true },
  { kind: "link", name: "GitHub Inventory", href: "/integrations/github", icon: Github, category: "Runtime", adminOnly: true },
];

function primaryCommands(items: NavItem[]): CommandPaletteRoute[] {
  return items.flatMap((item) => {
    if (item.kind === "link") return [{ ...item, category: "Navigate" }];
    return flattenNavItems([item]).map((child) => ({ ...child, category: item.name }));
  });
}

export function commandPaletteRoutesFor(
  capabilities: AuthCapabilities,
  isAdmin: boolean
): CommandPaletteRoute[] {
  const primary = primaryCommands(filterNavItemsByAccess(primaryNavItems, capabilities, isAdmin));
  const secondary = filterNavItemsByAccess(secondaryCommandRoutes, capabilities, isAdmin) as CommandPaletteRoute[];
  const unique = new Map<string, CommandPaletteRoute>();
  for (const route of [...primary, ...secondary]) {
    if (!unique.has(route.href)) unique.set(route.href, route);
  }
  return [...unique.values()];
}
