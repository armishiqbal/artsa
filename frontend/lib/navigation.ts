import {
  LayoutDashboard,
  Activity,
  Network,
  Swords,
  BookOpen,
  Database,
  FileCode,
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
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  capability?: keyof import("@/lib/hooks/useAuthRole").AuthCapabilities;
}

export interface NavSection {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
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
      { name: "Red Team Console", href: "/campaigns", icon: Swords, capability: "can_run_campaigns" },
      { name: "Attack Sandbox", href: "/sandbox", icon: Crosshair },
      { name: "Guard capabilities", href: "/guides/guard-capabilities", icon: Shield },
      { name: "RAG Scanner", href: "/rag-scanner", icon: Database },
      { name: "Attack Library", href: "/library", icon: BookOpen },
      { name: "Replay", href: "/replay", icon: FileCode },
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
