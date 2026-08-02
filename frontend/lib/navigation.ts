import {
  LayoutDashboard,
  Activity,
  Network,
  Swords,
  BookOpen,
  FileCode,
  ScanLine,
  FileText,
  Users,
  Shield,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** RBAC capability required to show this nav item */
  capability?: keyof import("@/lib/hooks/useAuthRole").AuthCapabilities;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    label: "Operations",
    items: [
      { name: "Command Center", href: "/", icon: LayoutDashboard },
      { name: "Observatory", href: "/observatory", icon: Activity },
      { name: "Topology", href: "/topology", icon: Network },
      { name: "Policies", href: "/policies", icon: Shield, capability: "can_manage_policies" },
    ],
  },
  {
    label: "Red Team",
    items: [
      { name: "Wargame", href: "/wargame", icon: Swords, capability: "can_run_campaigns" },
      { name: "Attack Library", href: "/attack-library", icon: BookOpen },
      { name: "Replay", href: "/replay", icon: FileCode },
    ],
  },
  {
    label: "Analysis",
    items: [
      { name: "Defense X-Ray", href: "/xray", icon: ScanLine },
      { name: "Reports", href: "/reports", icon: FileText },
      { name: "Providers", href: "/providers", icon: Users },
    ],
  },
];
