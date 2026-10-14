import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CommandCenterPage from "@/app/(app)/command-center/page";

vi.mock("@/lib/context/ConnectionProvider", () => ({
  useConnection: () => ({
    apiOnline: true,
    wsConnected: true,
    activeSessions: 1,
    apiGatewayStatus: "fully_connected",
    setWsConnected: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useCampaigns", () => ({
  useCampaigns: () => ({
    campaigns: [
      {
        id: "camp-01",
        name: "Enterprise Multi-Agent Audit",
        status: "RUNNING",
        rounds_completed: 3,
        total_rounds: 8,
        summary: null,
      },
    ],
    loading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useFindings", () => ({
  useFindings: () => ({
    findings: [],
    loading: false,
    unavailable: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useTargets", () => ({
  useTargets: () => ({
    targets: [
      {
        id: "tgt-01",
        name: "Production Agent Core",
        authorized: true,
        provider: "openai",
        system_type: "agent",
      },
    ],
    loading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useProviders", () => ({
  useProviders: () => ({
    providers: [
      {
        id: "openai",
        name: "OpenAI",
        configured: true,
      },
    ],
    loading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useDashboardMetrics", () => ({
  useDashboardMetrics: () => ({
    metrics: {
      severity_counts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
      defense_layers: {},
      defense_score: 95,
      risk_trend: [],
      avg_risk_score: 12,
      max_risk_score: 45,
      active_sessions: 1,
      event_rate: 1.2,
      total_events: 8,
    },
    liveEvents: [],
    connected: true,
    loading: false,
    refreshMetrics: vi.fn(),
    appendLiveEvent: vi.fn(),
    pullTelemetryRecent: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useCommandCenterLiveOps", () => ({
  useCommandCenterLiveOps: () => ({
    state: {
      telemetryMode: "LIVE",
      isLive: true,
      tenantId: "tenant-mock",
      currentCampaign: {
        id: "camp-01",
        name: "Enterprise Multi-Agent Audit",
        status: "RUNNING",
        roundsCompleted: 3,
        totalRounds: 8,
      },
      currentSession: "sess-mock-01",
      currentRound: 3,
      agents: [],
      events: [],
      timeline: [],
      metrics: null,
      circuitBreaker: { status: "nominal", note: "Normal" },
      connection: { connected: true, lastConnectedAt: null, lastEventAt: null, reconnectCount: 0 },
      operatorActions: [],
      error: null,
    },
    killSession: vi.fn().mockResolvedValue({ success: true, action: "KILL", sessionId: "sess-mock-01" }),
    quarantineAgent: vi.fn().mockResolvedValue({ success: true, action: "QUARANTINE", sessionId: "sess-mock-01" }),
    blockTool: vi.fn().mockResolvedValue({ success: true, action: "BLOCK_TOOL", sessionId: "sess-mock-01" }),
    deployMitigation: vi.fn().mockResolvedValue({ success: true, action: "DEPLOY_MITIGATION", sessionId: "sess-mock-01" }),
    refresh: vi.fn(),
  }),
}));

// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("CommandCenterPage", () => {
  it("keeps a telemetry-mode label from opening the floor when there are no backend events", () => {
    render(<CommandCenterPage />);

    // Header & identity
    expect(screen.getByRole("heading", { level: 1, name: /Command Center/i })).toBeInTheDocument();
    expect(screen.getByText(/Enterprise SecOps/i)).toBeInTheDocument();
    expect(screen.getByText(/ARTSA DEFENSE PLATFORM/i)).toBeInTheDocument();

    expect(screen.getByText("Recent events")).toBeInTheDocument();
    expect(screen.getByText("Active campaigns")).toBeInTheDocument();
    expect(screen.getByText("Telemetry transport")).toBeInTheDocument();
    expect(screen.getByText("Authorized targets")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No live campaign telemetry" })).toBeInTheDocument();

    // Tabs
    expect(screen.getByRole("tab", { name: /Tactical Operations Floor/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Fleet Posture & Readiness/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Attack Graph & Chain/i })).toBeInTheDocument();

    expect(screen.queryByRole("region", { name: /Agent Interaction Visualization/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Live Telemetry Ingest/i)).not.toBeInTheDocument();
  });

  it("switches between evidence views and preserves the no-telemetry state", () => {
    render(<CommandCenterPage />);

    // Switch to Fleet Posture & Readiness
    const postureTab = screen.getByRole("tab", { name: /Fleet Posture & Readiness/i });
    fireEvent.click(postureTab);

    expect(screen.getByText(/Assessment workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Enterprise Multi-Agent Audit/i)).toBeInTheDocument();

    // Switch to Attack Graph & Chain
    const topologyTab = screen.getByRole("tab", { name: /Attack Graph & Chain/i });
    fireEvent.click(topologyTab);

    expect(
      screen.getByRole("heading", { name: /Attack Graph & Lateral Blast Path/i })
    ).toBeInTheDocument();

    // Switch back to Tactical
    const tacticalTab = screen.getByRole("tab", { name: /Tactical Operations Floor/i });
    fireEvent.click(tacticalTab);

    expect(screen.getByRole("heading", { name: "No live campaign telemetry" })).toBeInTheDocument();
  });
});
