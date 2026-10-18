import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RedTeamCampaignsPage from "@/app/(app)/red-team/campaigns/page";
import RedTeamHomePage from "@/app/(app)/red-team/page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "new" ? null : null),
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useAuthRole", () => ({
  useAuthRole: () => ({
    capabilities: { can_run_campaigns: true },
    loading: false,
  }),
}));

vi.mock("@/lib/hooks/useCampaigns", () => ({
  useCampaigns: () => ({
    campaigns: [],
    loading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/context/DashboardMetricsProvider", () => ({
  useDashboardMetrics: () => ({
    liveEvents: [],
    connected: false,
    metrics: null,
  }),
}));

vi.mock("@/lib/context/ConnectionProvider", () => ({
  useConnection: () => ({
    apiOnline: true,
    wsConnected: false,
  }),
}));

// ResizeObserver mock for Recharts
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("Red Team War Room & Campaigns Multi-Agent Pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("RedTeamCampaignsPage", () => {
    it("renders default Pre-Flight Simulation Suite with banner and CrewAI 6-agent visualizer", async () => {
      render(<RedTeamCampaignsPage />);

      expect(
        screen.getByText("Pre-Flight Multi-Agent Simulation · Labeled Demonstration Suite")
      ).toBeInTheDocument();
      expect(screen.getByText("CrewAI 6-Agent Chain")).toBeInTheDocument();
      expect(screen.getByText("Simulation Suite (3)")).toBeInTheDocument();
      expect(screen.getByText("Live Telemetry (0)")).toBeInTheDocument();

      // Check for CrewAI Six-Agent Chain visualization
      expect(
        screen.getByText(/Autonomous Multi-Agent Crew Pipeline/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/HMAC Chain Verified/i)).toBeInTheDocument();

      // Check that 3 demo campaigns are rendered across watch floor and table
      expect(
        screen.getAllByText("Campaign 101 · Direct Prompt Extraction (ASI01)").length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText("Campaign 102 · Tool Metadata SSRF Escape (ASI02)").length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText("Campaign 103 · Indirect RAG Knowledge Poisoning (ASI04)").length
      ).toBeGreaterThan(0);
    });

    it("toggles between Simulation Suite and Live Telemetry with zero-state notice", async () => {
      render(<RedTeamCampaignsPage />);

      const liveBtn = screen.getByRole("button", { name: /Live Telemetry/i });
      fireEvent.click(liveBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Live Operations Telemetry · No Campaigns Recorded")
        ).toBeInTheDocument();
      });

      // Shows zero state in campaigns table and cohort hero
      expect(screen.getAllByText(/No campaigns yet/i).length).toBeGreaterThan(0);

      // Click "Switch to Simulation Suite" in the banner
      const switchBackBtn = screen.getByRole("button", {
        name: /Switch to Simulation Suite/i,
      });
      fireEvent.click(switchBackBtn);

      await waitFor(() => {
        expect(
          screen.getAllByText("Campaign 101 · Direct Prompt Extraction (ASI01)").length
        ).toBeGreaterThan(0);
      });
    });
  });

  describe("RedTeamHomePage", () => {
    it("renders Red Team Home with Pre-Flight Simulation Suite, Banner, and CrewAI Visualizer", async () => {
      render(<RedTeamHomePage />);

      expect(
        screen.getByText("Pre-Flight Multi-Agent Simulation · Labeled Demonstration Suite")
      ).toBeInTheDocument();
      expect(screen.getByText("Simulation Suite (3)")).toBeInTheDocument();
      expect(screen.getByText("Live Telemetry (0)")).toBeInTheDocument();

      // Verify Six-Agent Chain visualizer
      expect(
        screen.getByText(/Autonomous Multi-Agent Crew Pipeline/i)
      ).toBeInTheDocument();
      expect(screen.getByText("Red Team War Room")).toBeInTheDocument();
    });

    it("toggles Red Team Home to live telemetry mode and displays empty state guidance", async () => {
      render(<RedTeamHomePage />);

      const liveBtn = screen.getByRole("button", { name: /Live Telemetry/i });
      fireEvent.click(liveBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Live Operations Telemetry · No Campaigns Recorded")
        ).toBeInTheDocument();
      });

      const switchBtn = screen.getByRole("button", {
        name: /Switch to Simulation Suite/i,
      });
      fireEvent.click(switchBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Pre-Flight Multi-Agent Simulation · Labeled Demonstration Suite")
        ).toBeInTheDocument();
      });
    });
  });
});
