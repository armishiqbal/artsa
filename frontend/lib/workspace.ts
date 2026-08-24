import {
  LayoutDashboard,
  BarChart3,
  ScrollText,
  Network,
  Swords,
  Crosshair,
  Database,
  BookOpen,
  FileCode,
  ShieldAlert,
  FileText,
  Shield,
  Settings2,
  Users,
  Activity,
  KeyRound,
  Rocket,
  type LucideIcon,
} from "lucide-react";

export interface WorkspaceLink {
  name: string;
  href: string;
  icon: LucideIcon;
}

export interface WorkspaceContext {
  related: WorkspaceLink[];
  next?: WorkspaceLink;
  hint: string;
}

const L = {
  start: { name: "Get Started", href: "/get-started", icon: Rocket },
  dash: { name: "Command Center", href: "/dashboard", icon: LayoutDashboard },
  analytics: { name: "Analytics", href: "/analytics", icon: BarChart3 },
  logs: { name: "Logs", href: "/logs", icon: ScrollText },
  topology: { name: "Topology", href: "/dashboard/topology", icon: Network },
  wargame: { name: "Wargame", href: "/campaigns", icon: Swords },
  sandbox: { name: "Attack Sandbox", href: "/sandbox", icon: Crosshair },
  capabilities: { name: "Guard capabilities", href: "/guides/guard-capabilities", icon: Shield },
  rag: { name: "RAG Scanner", href: "/rag-scanner", icon: Database },
  library: { name: "Attack Library", href: "/library", icon: BookOpen },
  replay: { name: "Replay", href: "/replay", icon: FileCode },
  risks: { name: "Agentic Risks", href: "/risks", icon: ShieldAlert },
  reports: { name: "Reports", href: "/reports", icon: FileText },
  policies: { name: "Policies", href: "/admin/policies", icon: Shield },
  settings: { name: "Settings", href: "/settings", icon: Settings2 },
  providers: { name: "Providers", href: "/admin/providers", icon: Users },
  alerts: { name: "Alerts", href: "/admin/alerts", icon: Activity },
  system: { name: "System & Keys", href: "/admin/system", icon: KeyRound },
  admin: { name: "Admin Overview", href: "/admin", icon: Shield },
} as const;

const HINT = "⌘K jump anywhere · click a card to drill in";

function match(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

/** Contextual next-steps for every product surface (HCI: relatedness + closure). */
export function workspaceFor(pathname: string): WorkspaceContext {
  if (match(pathname, "/get-started")) {
    return {
      related: [L.dash, L.logs, L.sandbox],
      next: L.logs,
      hint: "Step 1 tests → Step 2 ingest → Step 3 confirm in log",
    };
  }
  if (match(pathname, "/guides/guard-capabilities")) {
    return {
      related: [L.sandbox, L.capabilities, L.library],
      next: L.sandbox,
      hint: "Capability reference — run live tests in Sandbox",
    };
  }
  if (match(pathname, "/guides/rag-astra")) {
    return {
      related: [L.rag, L.start, L.dash],
      next: L.start,
      hint: "Guard queries at ingest time — not Astra webhooks alone",
    };
  }
  if (match(pathname, "/dashboard/topology")) {
    return { related: [L.dash, L.logs, L.replay], next: L.replay, hint: HINT };
  }
  if (match(pathname, "/dashboard")) {
    return { related: [L.logs, L.analytics, L.sandbox], next: L.sandbox, hint: HINT };
  }
  if (match(pathname, "/analytics")) {
    return { related: [L.dash, L.logs, L.risks], next: L.reports, hint: HINT };
  }
  if (match(pathname, "/logs")) {
    return { related: [L.dash, L.replay, L.risks], next: L.replay, hint: "Filter severity · click a row for replay" };
  }
  if (match(pathname, "/campaigns")) {
    return { related: [L.library, L.sandbox, L.reports], next: L.library, hint: HINT };
  }
  if (match(pathname, "/sandbox")) {
    return {
      related: [L.library, L.rag, L.start],
      next: L.start,
      hint: "Sandbox tests the guard — ingest wires Command Center",
    };
  }
  if (match(pathname, "/rag-scanner")) {
    return { related: [L.rag, L.sandbox, L.start], next: L.sandbox, hint: HINT };
  }
  if (match(pathname, "/library")) {
    return { related: [L.sandbox, L.wargame, L.risks], next: L.sandbox, hint: "Search templates · open in sandbox" };
  }
  if (match(pathname, "/replay")) {
    return { related: [L.logs, L.dash, L.reports], next: L.logs, hint: HINT };
  }
  if (match(pathname, "/risks")) {
    return { related: [L.library, L.logs, L.policies], next: L.library, hint: HINT };
  }
  if (match(pathname, "/reports")) {
    return { related: [L.wargame, L.analytics, L.dash], next: L.wargame, hint: HINT };
  }
  if (match(pathname, "/admin/policies")) {
    return { related: [L.sandbox, L.risks, L.providers], next: L.sandbox, hint: HINT };
  }
  if (match(pathname, "/admin/providers")) {
    return { related: [L.system, L.sandbox, L.wargame], next: L.sandbox, hint: HINT };
  }
  if (match(pathname, "/admin/alerts")) {
    return { related: [L.settings, L.dash, L.logs], next: L.dash, hint: HINT };
  }
  if (match(pathname, "/admin/system")) {
    return { related: [L.providers, L.settings, L.admin], next: L.providers, hint: HINT };
  }
  if (match(pathname, "/admin")) {
    return { related: [L.providers, L.policies, L.alerts], next: L.providers, hint: HINT };
  }
  if (pathname.startsWith("/settings")) {
    return { related: [L.admin, L.alerts, L.dash], next: L.admin, hint: HINT };
  }
  return { related: [L.dash, L.sandbox, L.logs], next: L.dash, hint: HINT };
}
