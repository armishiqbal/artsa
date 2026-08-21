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
  /** Section visible only to the admin role (admin console). */
  adminOnly?: boolean;
}

export const navSections: NavSection[] = [
  {
    label: "Get Started",
    items: [{ name: "Get Started", href: "/get-started", icon: Rocket }],
  },
  {
    // Runtime guardrail: watch and defend agents in production.
    label: "Protect",
    items: [
      { name: "Command Center", href: "/dashboard", icon: LayoutDashboard },
      { name: "Topology", href: "/dashboard/topology", icon: Network },
    ],
  },
  {
    // Red-team wargame: attack your own AI before launch.
    label: "Test",
    items: [
      { name: "Wargame", href: "/campaigns", icon: Swords, capability: "can_run_campaigns" },
      { name: "Attack Sandbox", href: "/sandbox", icon: Crosshair },
      { name: "RAG Scanner", href: "/rag-scanner", icon: Database },
      { name: "Attack Library", href: "/library", icon: BookOpen },
      { name: "Replay", href: "/replay", icon: FileCode },
    ],
  },
  {
    // Analysis & audit: understand and report on findings.
    label: "Investigate",
    items: [
      { name: "Agentic Risks", href: "/risks", icon: ShieldAlert },
      { name: "Reports", href: "/reports", icon: FileText },
    ],
  },
  {
    // Admin console: platform configuration, credentials, integrations.
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
