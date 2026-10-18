import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RoundReplayPage from "@/app/(app)/replay/ReplayContent";

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "session" ? null : null),
  }),
}));

vi.mock("@/lib/api", () => ({
  fetchFromBackend: vi.fn().mockImplementation((path: string) => {
    if (path.includes("/api/v1/sessions?limit=50")) {
      return Promise.resolve([]);
    }
    if (path.includes("/api/v1/approvals")) {
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  }),
}));

describe("RoundReplayPage (ReplayContent)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default Incident Walkthrough suite and displays guidance banner", async () => {
    render(<RoundReplayPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Pre-Flight Incident Walkthrough · Labeled Demonstration Suite")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Incident Walkthrough (3)")).toBeInTheDocument();
    expect(screen.getByText("Live Operations (0)")).toBeInTheDocument();
    expect(
      screen.getAllByText("autonomous-rag-copilot-prod").length
    ).toBeGreaterThan(0);
  });

  it("renders live empty state when toggled to live operations with zero recorded sessions", async () => {
    render(<RoundReplayPage />);

    const liveButton = screen.getByRole("button", { name: /Live Operations/i });
    fireEvent.click(liveButton);

    await waitFor(() => {
      expect(
        screen.getByText("No Live Operations Telemetry Recorded")
      ).toBeInTheDocument();
    });

    // Can toggle back using the button in the empty state
    const switchBackBtn = screen.getByRole("button", {
      name: /Switch to Incident Walkthrough Suite/i,
    });
    fireEvent.click(switchBackBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Pre-Flight Incident Walkthrough · Labeled Demonstration Suite")
      ).toBeInTheDocument();
    });
  });

  it("switches tabs between audit, graph, workbench, and autopsy", async () => {
    render(<RoundReplayPage />);

    const graphTab = screen.getByRole("button", { name: /Attack Graph Topology/i });
    fireEvent.click(graphTab);
    expect(screen.getByText("Recorded Session Event Path")).toBeInTheDocument();

    const workbenchTab = screen.getByRole("button", { name: /Execution Chain Workbench/i });
    fireEvent.click(workbenchTab);
    expect(screen.getByText("Attack Path Execution Chain")).toBeInTheDocument();

    const auditTab = screen.getByRole("button", { name: /Activity & Identity Audit Log/i });
    fireEvent.click(auditTab);
    expect(screen.getByText("Activity & Identity Audit Trail")).toBeInTheDocument();
  });
});
