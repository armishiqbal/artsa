import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Search } from "lucide-react";

import { RiskScore } from "@/components/shared/RiskScore";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { LiveIndicator } from "@/components/shared/LiveIndicator";
import { EmptyState } from "@/components/shared/EmptyState";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { PageHeader } from "@/components/shared/PageHeader";

describe("RiskScore", () => {
  it("renders the formatted score with the /100 suffix", () => {
    render(<RiskScore score={92.4} />);
    expect(screen.getByText("92.4")).toBeInTheDocument();
    expect(screen.getByText("/100")).toBeInTheDocument();
  });

  it("applies the critical variant for scores >= 80", () => {
    render(<RiskScore score={92.4} />);
    const badge = screen.getByText("92.4").closest("div");
    expect(badge).toHaveClass("bg-destructive/15");
  });

  it("applies the success variant for low scores", () => {
    render(<RiskScore score={12.0} />);
    const badge = screen.getByText("12.0").closest("div");
    expect(badge).toHaveClass("bg-status-success/15");
  });
});

describe("SeverityBadge", () => {
  it("renders the severity label and exposes it via aria-label", () => {
    render(<SeverityBadge severity="CRITICAL" />);
    const badge = screen.getByLabelText("Severity: CRITICAL");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("CRITICAL");
  });

  it("pulses for critical severities", () => {
    render(<SeverityBadge severity="CRITICAL" />);
    expect(screen.getByLabelText("Severity: CRITICAL")).toHaveClass("animate-pulse");
  });

  it("maps LOW to the info variant", () => {
    render(<SeverityBadge severity="LOW" />);
    expect(screen.getByLabelText("Severity: LOW")).toHaveClass("bg-severity-info/15");
  });
});

describe("LiveIndicator", () => {
  it("shows connected state by default", () => {
    render(<LiveIndicator connected />);
    expect(screen.getByRole("status")).toHaveTextContent("Live feed connected");
  });

  it("falls back to polling state when disconnected", () => {
    render(<LiveIndicator connected={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("Polling fallback");
  });

  it("honors a custom label", () => {
    render(<LiveIndicator connected label="Ingest stream" />);
    expect(screen.getByRole("status")).toHaveTextContent("Ingest stream");
  });
});

describe("EmptyState", () => {
  it("renders title, description and action", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <EmptyState
        icon={Search}
        title="No results"
        description="Adjust your filters and try again."
        action={
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        }
      />
    );

    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.getByText("Adjust your filters and try again.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders without an action slot", () => {
    render(<EmptyState icon={Search} title="Empty" description="Nothing here." />);
    expect(screen.getByText("Empty")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("DashboardCard", () => {
  it("renders title, description, badge and children", () => {
    render(
      <DashboardCard title="Risk Trend" description="90-day window" badge={<span>LIVE</span>}>
        <p>chart placeholder</p>
      </DashboardCard>
    );

    expect(screen.getByRole("heading", { name: "Risk Trend" })).toBeInTheDocument();
    expect(screen.getByText("90-day window")).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("chart placeholder")).toBeInTheDocument();
  });

  it("omits the description when not provided", () => {
    render(<DashboardCard title="Bare">content</DashboardCard>);
    expect(screen.getByRole("heading", { name: "Bare" })).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(screen.queryByText("90-day window")).not.toBeInTheDocument();
  });
});

describe("PageHeader", () => {
  it("renders the page title and description", () => {
    render(<PageHeader title="Wargame Simulation" description="Configure and launch campaigns." />);
    expect(screen.getByRole("heading", { level: 1, name: "Wargame Simulation" })).toBeInTheDocument();
    expect(screen.getByText("Configure and launch campaigns.")).toBeInTheDocument();
  });

  it("renders action elements and wires their handlers", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();

    render(
      <PageHeader title="Reports" actions={<button onClick={onExport}>Export</button>} />
    );

    const action = screen.getByRole("button", { name: "Export" });
    expect(action).toBeInTheDocument();
    await user.click(action);
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});
