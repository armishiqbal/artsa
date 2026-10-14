import { describe, expect, it } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandCenterFloor } from "@/components/command-center/CommandCenterFloor";
import {
  DEFAULT_FILTERS,
  buildStrategicModel,
  deriveContainment,
  featuredAsi,
  hmacLabel,
  inspectorFor,
  techniquesFrom,
  yAxisScale,
} from "@/components/command-center/prototype/model";

describe("yAxisScale", () => {
  it("returns strictly ascending ticks inside the domain", () => {
    const { domain, ticks } = yAxisScale([62, 72, 84, 90]);
    expect(domain[0]).toBeLessThan(domain[1]);
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    expect(ticks[0]).toBe(domain[0]);
    expect(ticks[ticks.length - 1]).toBe(domain[1]);
  });
});

describe("buildStrategicModel honesty", () => {
  it("labels the seeded empty-floor sample as walkthrough", () => {
    const model = buildStrategicModel({
      events: [],
      campaigns: [],
      filters: DEFAULT_FILTERS,
      now: Date.parse("2026-09-06T12:00:00.000Z"),
    });
    expect(model.walkthrough).toBe(true);
    expect(model.trustDerived).toBe(true);
    expect(model.series.length).toBeGreaterThan(8);
    expect(model.series.every((p) => p.label.startsWith("R"))).toBe(false);
    expect(model.lift.last).toBe(model.series[model.series.length - 1]?.artsa);
    expect(model.recordedAlerts).toBeGreaterThanOrEqual(0);
    expect(model.curveProvenance).toBe("walkthrough");
    expect(model.monitors.find((m) => m.id === "checkpoint")?.value).toBe("UNAVAILABLE");
    expect(model.monitors.find((m) => m.id === "asi08")).toBeUndefined();
    expect(model.monitors.find((m) => m.id === "disagree")?.name).toBe("Judge/Defender disagreement");
    expect(model.campaignList).toHaveLength(2);
    const asi08 = featuredAsi(model.asi).find((a) => a.code === "ASI08");
    expect(asi08?.built).toBeNull();
    expect(asi08?.coverage).toBeNull();
  });

  it("does not treat ingest rows as signed HMAC handoffs", () => {
    const now = Date.parse("2026-09-06T12:00:00.000Z");
    const events = Array.from({ length: 8 }, (_, i) => ({
      timestamp: new Date(now - i * 60_000).toISOString(),
      agent_id: "red-team-1",
      tool_name: "user_prompt",
      risk_score: 40,
      verdict: "SCAN",
    }));
    const model = buildStrategicModel({
      events,
      campaigns: [
        {
          id: "cmp-1",
          name: "Nightly probe",
          status: "running",
          provider: "openai",
          model: "gpt-4o",
          rounds_completed: 2,
          total_rounds: 4,
        },
      ],
      filters: DEFAULT_FILTERS,
      now,
    });
    expect(model.walkthrough).toBe(false);
    expect(model.hmacSigned).toBe(false);
    expect(model.hmacRate).toBeNull();
    expect(model.hops.every((h) => h.hmacState === "unknown")).toBe(true);
    expect(model.hops.every((h) => hmacLabel(h.hmacState) === "unknown")).toBe(true);
    expect(model.hops.every((h) => h.latencyMs === null)).toBe(true);
    expect(model.series).toHaveLength(0);
    expect(model.curveProvenance).toBe("unavailable");
    const hmac = inspectorFor(model, "monitor", "hmac");
    expect(hmac?.fields.some((f) => f.value === "UNAVAILABLE")).toBe(true);
    expect(hmac?.fields.some((f) => f.label === "Source")).toBe(false);
  });
});

describe("Executive Mission Posture and Active Containment (R2 & R3)", () => {
  it("derives live mission posture and tracks containment across sessions", () => {
    const now = Date.parse("2026-09-06T12:00:00.000Z");
    const events = [
      {
        session_id: "sess-1",
        timestamp: new Date(now - 60_000).toISOString(),
        agent_id: "red-team-1",
        tool_name: "tool_exfiltration",
        risk_score: 85,
        verdict: "BREACHED",
        action: "KILL",
      },
      {
        session_id: "sess-2",
        timestamp: new Date(now - 50_000).toISOString(),
        agent_id: "target-1",
        tool_name: "prompt_injection",
        risk_score: 65,
        verdict: "SUSPICIOUS",
        action: "QUARANTINE",
      },
      {
        session_id: "sess-3",
        timestamp: new Date(now - 40_000).toISOString(),
        agent_id: "judge-1",
        tool_name: "privilege_pivot",
        risk_score: 60,
        verdict: "SUSPICIOUS",
        action: "BLOCK",
      },
      {
        session_id: "sess-4",
        timestamp: new Date(now - 30_000).toISOString(),
        agent_id: "defender-1",
        tool_name: "safe_call",
        risk_score: 10,
        verdict: "SAFE",
        action: "ALLOW",
      },
    ];

    const model = buildStrategicModel({
      events,
      campaigns: [
        {
          id: "cmp-alpha",
          name: "Alpha Campaign",
          status: "running",
          provider: "openai",
          model: "gpt-4o",
          rounds_completed: 1,
          total_rounds: 3,
        },
      ],
      filters: DEFAULT_FILTERS,
      now,
    });

    // A few event rows do not establish the posture of all six agents.
    expect(model.mission.posture).toBe("unknown");
    expect(model.mission.headline.length).toBeGreaterThan(10);

    // R3: Active containment
    expect(model.containment.total).toBe(3);
    expect(model.containment.terminated).toBe(1);
    expect(model.containment.quarantined).toBe(2);
    expect(model.containment.sparkline).toHaveLength(0);
  });
});

describe("Threat Vectors & Dominant Techniques (R4)", () => {
  it("renders attack technique distribution with percentages", () => {
    const model = buildStrategicModel({
      events: [],
      campaigns: [],
      filters: DEFAULT_FILTERS,
      now: Date.parse("2026-09-06T12:00:00.000Z"),
    });

    expect(model.techniques.length).toBeGreaterThan(0);
    expect(model.techniques.every((t) => t.pct >= 0 && t.pct <= 100)).toBe(true);
    expect(model.techniques.some((t) => t.name === "Tool Exfiltration" || t.name.includes("Tool"))).toBe(true);

    const totalPct = model.techniques.reduce((sum, t) => sum + t.pct, 0);
    expect(totalPct).toBeGreaterThan(0);
    expect(totalPct).toBeLessThanOrEqual(100);
  });
});

describe("Contextual SOC Deep-Linking in Inspector (R5)", () => {
  const model = buildStrategicModel({
    events: [],
    campaigns: [],
    filters: DEFAULT_FILTERS,
    now: Date.parse("2026-09-06T12:00:00.000Z"),
  });

  it("provides pre-filtered query parameters for agent hops", () => {
    const target = inspectorFor(model, "hop", "Target");
    expect(target).not.toBeNull();
    expect(target?.detectionsHref).toBe("/red-team/monitor?agent=Target");
    expect(target?.logsHref).toBe("/logs?agent=Target");
    expect(target?.links?.some((l) => l.href === "/red-team/monitor?agent=Target")).toBe(true);
    expect(target?.links?.some((l) => l.href === "/logs?agent=Target")).toBe(true);
  });

  it("provides pre-filtered query parameters for ASI categories", () => {
    const target = inspectorFor(model, "asi", "ASI01");
    expect(target).not.toBeNull();
    expect(target?.detectionsHref).toBe("/red-team/monitor?asi=ASI01");
    expect(target?.links?.some((l) => l.href === "/red-team/monitor?asi=ASI01")).toBe(true);
  });

  it("provides deep links for campaign monitors and session replay", () => {
    const firstCampaign = model.campaigns[0];
    expect(firstCampaign).toBeDefined();
    const target = inspectorFor(model, "campaign", firstCampaign!.campaignId);
    expect(target).not.toBeNull();
    expect(target?.detectionsHref).toBe(`/red-team/monitor/${encodeURIComponent(firstCampaign!.campaignId)}`);
    expect(target?.replayHref).toBe(`/replay?campaign=${encodeURIComponent(firstCampaign!.campaignId)}`);
    expect(target?.links?.some((l) => l.href.includes("/replay?campaign="))).toBe(true);
  });

  it("links strategic monitors to /admin/alerts", () => {
    const hmac = inspectorFor(model, "monitor", "hmac");
    expect(hmac?.alertsHref).toBe("/admin/alerts");
    expect(hmac?.links?.some((l) => l.href === "/admin/alerts")).toBe(true);

    const slo = inspectorFor(model, "monitor", "slo");
    expect(slo?.alertsHref).toBe("/admin/alerts");

    const disagree = inspectorFor(model, "monitor", "disagree");
    expect(disagree?.alertsHref).toBe("/admin/alerts");

    const containment = inspectorFor(model, "monitor", "containment");
    expect(containment?.alertsHref).toBe("/admin/alerts");
  });
});

describe("Containment Accuracy & Edge Cases", () => {
  it("does not count an uncontained breach (verdict BREACHED, action ALLOW) as terminated containment", () => {
    const events = [
      {
        session_id: "sess-breach-uncontained",
        verdict: "BREACHED",
        action: "ALLOW",
        status: "ACTIVE",
      },
    ];
    const containment = deriveContainment(events, [], false);
    expect(containment.terminated).toBe(0);
    expect(containment.quarantined).toBe(0);
    expect(containment.total).toBe(0);
  });

  it("accurately attributes KILL and QUARANTINE actions to session containment", () => {
    const events = [
      {
        session_id: "sess-kill",
        action: "KILL",
        verdict: "BREACHED",
      },
      {
        session_id: "sess-quarantine",
        action: "QUARANTINE",
        verdict: "SUSPICIOUS",
      },
      {
        session_id: "sess-block",
        action: "BLOCK",
        verdict: "DENIED",
      },
    ];
    const containment = deriveContainment(events, [], false);
    expect(containment.terminated).toBe(1);
    expect(containment.quarantined).toBe(2);
    expect(containment.total).toBe(3);
    expect(containment.sparkline).toHaveLength(0);
  });
});

describe("Taxonomy Fallback & Filter Resilience (Open Issues 3 & 4)", () => {
  it("uses structured ASI tags and does not infer a technique from message text", () => {
    const agentEvents = [
      {
        type: "finding" as const,
        timestamp: new Date().toISOString(),
        sourceAgent: "Red Team",
        targetAgent: "Target",
        status: "nominal" as const,
        asiTag: "ASI02",
        message: "Red Team executed tool misuse via custom_payload",
      },
      {
        type: "finding" as const,
        timestamp: new Date().toISOString(),
        sourceAgent: "Target",
        targetAgent: "Defender",
        status: "nominal" as const,
        asiTag: "ASI03",
        message: "Target privilege pivot attempt detected",
      },
    ];
    const techniques = techniquesFrom(agentEvents);
    expect(techniques.length).toBeGreaterThan(0);
    expect(techniques.some((t) => t.asiCode === "ASI02")).toBe(true);
    expect(techniques.some((t) => t.asiCode === "ASI03")).toBe(true);
    const unstructuredOnly = techniquesFrom([{ ...agentEvents[0]!, asiTag: undefined }]);
    expect(unstructuredOnly).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Unclassified Vector", asiCode: undefined }),
    ]));
  });

  it("gracefully falls back when custom filter yields zero events in walkthrough mode", () => {
    const model = buildStrategicModel({
      events: [],
      campaigns: [],
      filters: { ...DEFAULT_FILTERS, asi: "ASI08" },
      now: Date.parse("2026-09-06T12:00:00.000Z"),
    });

    // The ASI08 filter has no matching seeded sample event, so derived values stay empty.
    expect(model.techniques).toHaveLength(0);
    expect(model.hops).toHaveLength(6);
    expect(model.mission.posture).toBe("unknown");
    expect(model.containment.total).toBeGreaterThan(0);
  });
});

describe("Adaptive Lift Sign Formatting", () => {
  it("formats positive lift with + and negative lift without duplicate +-", () => {
    const formatLift = (val: number) => `${val >= 0 ? "+" : ""}${val}pp`;
    expect(formatLift(12.5)).toBe("+12.5pp");
    expect(formatLift(-3.2)).toBe("-3.2pp");
    expect(formatLift(0)).toBe("+0pp");
  });
});

describe("CommandCenterFloor DOM & Layout Architecture", () => {
  it("labels seeded walkthrough metrics as simulation content", () => {
    render(
      React.createElement(CommandCenterFloor, {
        events: [],
        campaigns: [],
        apiOnline: true,
        wsConnected: true,
      })
    );

    expect(screen.getByText("TRUST CHAIN")).toBeInTheDocument();
    expect(screen.getByText("DETECTION RATE")).toBeInTheDocument();
    expect(screen.getByText("DISAGREEMENT RATE")).toBeInTheDocument();
    expect(screen.getByText("Judge vs Defender · lower is better")).toBeInTheDocument();
    expect(screen.getByText("RECORDED ALERTS")).toBeInTheDocument();
    expect(screen.getByText("SIMULATION", { exact: true })).toBeInTheDocument();

    expect(screen.getByText("91.2%")).toBeInTheDocument();
    expect(screen.getByText("86%")).toBeInTheDocument();
    expect(screen.getByText("9%")).toBeInTheDocument();
    expect(screen.getByText("70")).toBeInTheDocument();
  });

  it("labels the seeded detection chart as a walkthrough sample", () => {
    const { container } = render(
      React.createElement(CommandCenterFloor, {
        events: [],
        campaigns: [],
        apiOnline: true,
        wsConnected: true,
      })
    );

    expect(screen.getByText("DETECTION RATE HISTORY")).toBeInTheDocument();
    expect(screen.getByText("Walkthrough sample")).toBeInTheDocument();

    const chartContainer = container.querySelector('[data-testid="detection-chart-container"]');
    expect(chartContainer).toBeInTheDocument();
  });

  it("marks seeded prompt content and confidence bars as walkthrough samples", () => {
    render(
      React.createElement(CommandCenterFloor, {
        events: [],
        campaigns: [],
        apiOnline: true,
        wsConnected: true,
      })
    );

    expect(screen.getByRole("region", { name: "Walkthrough prompt sample" })).toBeInTheDocument();
    expect(screen.getByText(/round 1 · status unavailable/i)).toBeInTheDocument();
    expect(screen.getByText("Walkthrough sample text")).toBeInTheDocument();
    expect(screen.getByText("customer_db")).toBeInTheDocument();
    expect(screen.getByText(/ASI01 hijack/i)).toBeInTheDocument();
    expect(screen.getByText(/ASI04 exfil/i)).toBeInTheDocument();
  });

  it("renders side-by-side AGENT MONITORS and MISSION LOG", () => {
    render(
      React.createElement(CommandCenterFloor, {
        events: [],
        campaigns: [],
        apiOnline: true,
        wsConnected: true,
      })
    );

    expect(screen.getByText("AGENT MONITORS")).toBeInTheDocument();
    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(screen.getByText("Curator")).toBeInTheDocument();
    expect(screen.getByText("Red team")).toBeInTheDocument();
    expect(screen.getByText("Target")).toBeInTheDocument();
    expect(screen.getByText("Judge")).toBeInTheDocument();
    expect(screen.getByText("Defender")).toBeInTheDocument();

    expect(screen.getByText("MISSION LOG")).toBeInTheDocument();
  });

  it("advances rounds when clicking NEXT ROUND button", async () => {
    const user = userEvent.setup();
    render(
      React.createElement(CommandCenterFloor, {
        events: [],
        campaigns: [],
        apiOnline: true,
        wsConnected: true,
        disableAutoTicker: true,
      })
    );

    const nextBtn = screen.getByRole("button", { name: /NEXT SAMPLE →/i });
    expect(nextBtn).toBeInTheDocument();

    await user.click(nextBtn);
    expect(screen.getByText("Example round 2")).toBeInTheDocument();
  }, 15000);
});
