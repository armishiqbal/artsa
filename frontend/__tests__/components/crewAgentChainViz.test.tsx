import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CrewAgentChainViz } from "@/components/red-team/CrewAgentChainViz";
import { CREW_SIX_AGENTS } from "@/lib/redTeamDemoData";

describe("CrewAgentChainViz", () => {
  it("renders all 6 agents in the sequential chain with roles and HMAC verification", () => {
    render(<CrewAgentChainViz />);

    expect(screen.getByText(/Autonomous Multi-Agent Crew Pipeline/i)).toBeInTheDocument();
    expect(screen.getByText(/HMAC Chain Verified/i)).toBeInTheDocument();

    for (const agent of CREW_SIX_AGENTS) {
      expect(screen.getAllByText(agent.name).length).toBeGreaterThan(0);
      expect(screen.getByText(`Hop ${agent.order}`)).toBeInTheDocument();
    }
  });

  it("selects and inspects a specific agent role, goal, and tools on click", () => {
    const onSelect = vi.fn();
    render(<CrewAgentChainViz onSelectAgent={onSelect} />);

    // Click Red Team agent button
    const redTeamButton = screen.getByRole("button", {
      name: /Hop 3.*Red Team Agent/i,
    });
    fireEvent.click(redTeamButton);

    expect(onSelect).toHaveBeenCalledWith("red_team");

    // Inspector card details
    expect(
      screen.getAllByText(/Offensive Exploitation Specialist/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/Execute adaptive attack vectors against target/i)
    ).toBeInTheDocument();
    expect(screen.getByText("PayloadDispatcher")).toBeInTheDocument();
    expect(screen.getByText("SSRFInjector")).toBeInTheDocument();
  });

  it("allows selecting the Defender agent to inspect containment tools", () => {
    render(<CrewAgentChainViz activeAgentId="defender" />);

    expect(
      screen.getAllByText(/Adaptive Containment & Circuit Breaker/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("CircuitBreakerEnforcer")).toBeInTheDocument();
    expect(screen.getByText("SessionQuarantine")).toBeInTheDocument();
  });
});
