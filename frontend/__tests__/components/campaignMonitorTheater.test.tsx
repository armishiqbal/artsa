import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LiveMonitorPage from "@/app/(app)/red-team/monitor/[id]/page";

vi.mock("next/navigation", () => ({
  useParams: () => ({
    id: "camp-demo-01",
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "follow" ? "0" : null),
    toString: () => "",
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useCampaigns", () => ({
  useCampaigns: () => ({
    campaigns: [],
    loading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useLiveMonitorFeed", () => ({
  useLiveMonitorFeed: () => ({
    stream: [],
    events: [],
    agents: {
      research: "idle",
      curator: "idle",
      red_team: "idle",
      target: "idle",
      judge: "idle",
      defender: "idle",
    },
    campaignStatus: "COMPLETED",
    detection: { rate: 83.3, judged: 12, passed: 10, spark: [] },
    transport: "offline",
    wsConnected: false,
    refresh: vi.fn(),
  }),
}));

// Mock ResizeObserver for Recharts
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("LiveMonitorPage (/red-team/monitor/[id])", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders demo campaign with Pre-Flight Simulation Banner and Six-Agent Attack Chain", async () => {
    render(<LiveMonitorPage />);

    // Pre-flight guidance banner
    expect(
      screen.getByText("Pre-Flight Multi-Agent Simulation · Labeled Demonstration Suite")
    ).toBeInTheDocument();
    expect(screen.getByText("CrewAI 6-Agent Chain")).toBeInTheDocument();

    // Six-Agent Attack Chain header
    expect(
      screen.getByText("Six-Agent Autonomous Attack Chain")
    ).toBeInTheDocument();
    expect(
      screen.getByText("HMAC Custody Passing")
    ).toBeInTheDocument();

    // Verify 6 agent hops in the chain path and turn cards
    expect(screen.getAllByText("Hop 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hop 2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hop 3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hop 4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hop 5").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hop 6").length).toBeGreaterThan(0);

    // Verify Multi-Agent Turn Cards rendered
    expect(
      screen.getByText(/Multi-Agent Turn Execution/i)
    ).toBeInTheDocument();
  });

  it("switches round timeline and updates turn cards", async () => {
    render(<LiveMonitorPage />);

    // Click on round 6 button in timeline
    const round6Btn = screen.getByRole("button", { name: /R6/i });
    fireEvent.click(round6Btn);

    await waitFor(() => {
      expect(
        screen.getByText(/Multi-Agent Turn Execution · Round 6/i)
      ).toBeInTheDocument();
    });

    // In round 6, Breach Detected is shown
    expect(screen.getByText("Breach Detected")).toBeInTheDocument();
    expect(screen.getByText("Contained")).toBeInTheDocument();
  });
});
