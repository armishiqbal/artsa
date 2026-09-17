import { describe, it, expect } from "vitest";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  filterNavItemsByAccess,
  flattenNavItems,
  isNavHrefActive,
  navSections,
  primaryNavItems,
  type NavLink,
} from "@/lib/navigation";
import { commandPaletteRoutesFor, secondaryCommandRoutes } from "@/lib/command-palette-registry";
import { formatPayload, formatResponse } from "@/lib/replayFormat";

describe("cn (className merge)", () => {
  it("merges plain class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("drops falsy values", () => {
    expect(cn("px-2", false, null, undefined, "py-1")).toBe("px-2 py-1");
  });

  it("lets tailwind-merge resolve conflicting utilities (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });
});

describe("navigation", () => {
  const adminCapabilities = {
    can_ingest: true,
    can_run_campaigns: true,
    can_run_benchmark: true,
    can_run_ablation: true,
    can_manage_policies: true,
    can_manage_providers: true,
    can_manage_integrations: true,
    can_manage_targets: true,
    read_only: false,
  };

  it("defines top-level items for admins including Projects", () => {
    expect(primaryNavItems.map((item) => item.name)).toEqual([
      "Command Center",
      "AI Security Playground",
      "Findings",
      "Projects",
      "Activity",
      "Sessions",
      "Discover",
      "Red Team",
      "Settings",
    ]);
    expect(filterNavItemsByAccess(primaryNavItems, adminCapabilities, true)).toHaveLength(9);
  });

  it("hides the Settings group from non-admins", () => {
    const settings = primaryNavItems.find((item) => item.kind === "group" && item.id === "settings");
    expect(settings?.adminOnly).toBe(true);
    expect(filterNavItemsByAccess(primaryNavItems, adminCapabilities, false)).toHaveLength(8);
    expect(settings?.kind === "group" ? settings.children.map((item) => item.href) : []).toEqual([
      "/settings",
      "/settings/integrations",
      "/admin/providers",
      "/get-started",
      "/settings/team",
      "/admin/policies",
    ]);
  });

  it("gives every nav item a name, href and a renderable icon", () => {
    const items = navSections.flatMap((s) => flattenNavItems(s.items));
    expect(items.length).toBeGreaterThanOrEqual(10);
    for (const item of items) {
      expect(typeof item.name).toBe("string");
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.href.startsWith("/")).toBe(true);
      expect(React.isValidElement(React.createElement(item.icon))).toBe(true);
    }
  });

  it("gates privileged routes behind RBAC capabilities", () => {
    const byHref = new Map<string, NavLink>(
      navSections.flatMap((s) => flattenNavItems(s.items)).map((i) => [i.href, i])
    );
    expect(byHref.get("/admin/policies")?.capability).toBe("can_manage_policies");
    expect(byHref.get("/red-team/campaigns")?.capability).toBe("can_run_campaigns");
  });

  it("keeps the Discover and Red Team groups focused", () => {
    const discover = primaryNavItems.find((item) => item.kind === "group" && item.id === "discover");
    expect(discover?.kind === "group" ? discover.children.map((item) => item.name) : []).toEqual([
      "Targets",
      "AI Assets",
      "Agents",
      "Connections",
    ]);
    const redTeam = primaryNavItems.find((item) => item.kind === "group" && item.id === "red-team");
    expect(redTeam?.kind === "group" ? redTeam.children.map((item) => item.name) : []).toEqual([
      "Attack Lab",
      "Campaigns",
      "Detections",
    ]);
  });

  it("marks nested detection routes active without hijacking the command center", () => {
    expect(isNavHrefActive("/red-team/monitor/live", "/red-team/monitor")).toBe(true);
    expect(isNavHrefActive("/command-center/topology", "/command-center")).toBe(false);
  });

  it("keeps demoted routes searchable and deduplicated", () => {
    expect(secondaryCommandRoutes.map((route) => route.href)).toEqual([
      "/risks",
      "/red-team/surface",
      "/red-team",
      "/red-team/library",
      "/red-team/matrix",
      "/red-team/graph",
      "/reports",
      "/approvals",
      "/investigations",
      "/agents",
      "/integrations/github",
    ]);
    const commands = commandPaletteRoutesFor(adminCapabilities, true);
    expect(commands.some((route) => route.href === "/reports")).toBe(true);
    expect(new Set(commands.map((route) => route.href)).size).toBe(commands.length);
  });

  it("applies sidebar capabilities to command search", () => {
    const restricted = { ...adminCapabilities, can_run_campaigns: false };
    const commands = commandPaletteRoutesFor(restricted, false);
    expect(commands.some((route) => route.href.startsWith("/red-team"))).toBe(false);
    expect(commands.some((route) => route.href === "/admin/providers")).toBe(false);
    expect(commands.some((route) => route.href === "/reports")).toBe(true);
  });
});

describe("replayFormat", () => {
  it("passes through string payloads verbatim", () => {
    expect(formatPayload({ payload: "raw tool arguments" })).toBe("raw tool arguments");
  });

  it("pretty-prints non-string payloads", () => {
    const args = { payload: 42, detail: { a: 1 } };
    expect(formatPayload(args)).toBe(JSON.stringify(args, null, 2));
    expect(formatPayload({})).toBe("{}");
  });

  it("falls back when no defender response was captured", () => {
    expect(formatResponse(null)).toBe("No defender response captured.");
    expect(formatResponse(undefined)).toBe("No defender response captured.");
  });

  it("passes through response text and stringifies structured responses", () => {
    expect(formatResponse({ text: "blocked by guardrail" })).toBe("blocked by guardrail");
    const structured = { detail: { reason: "policy" } };
    expect(formatResponse(structured)).toBe(JSON.stringify(structured, null, 2));
  });
});

describe("workspace relatedness", () => {
  it("returns related links and a next action for core routes", async () => {
    const { workspaceFor } = await import("@/lib/workspace");
    const dash = workspaceFor("/command-center");
    expect(dash.related.length).toBeGreaterThan(0);
    expect(dash.next?.href).toBe("/red-team/lab");
    expect(workspaceFor("/logs").next?.href).toBe("/replay");
    expect(workspaceFor("/library").next?.href).toBe("/red-team/lab");
  });
});
