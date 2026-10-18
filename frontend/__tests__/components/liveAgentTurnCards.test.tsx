import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiveAgentTurnCards } from "@/components/red-team/LiveAgentTurnCards";
import { DEMO_CAMPAIGN_ROUND_EVENTS } from "@/lib/redTeamDemoData";

describe("LiveAgentTurnCards", () => {
  const round1Events = DEMO_CAMPAIGN_ROUND_EVENTS["camp-demo-01"].filter(
    (e) => e.round === 1
  );
  const round6Events = DEMO_CAMPAIGN_ROUND_EVENTS["camp-demo-01"].filter(
    (e) => e.round === 6
  );

  it("renders all 6 sequential agent hops with role badges, tools, and HMAC custody", () => {
    render(<LiveAgentTurnCards round={1} events={round1Events} />);

    expect(
      screen.getByText(/Multi-Agent Turn Execution · Round 1/i)
    ).toBeInTheDocument();
    expect(screen.getByText("CrewAI Sequential Chain")).toBeInTheDocument();

    // Verify all 6 agent hops are present in sequential order
    expect(screen.getByText("Research Agent")).toBeInTheDocument();
    expect(screen.getByText("Curator Agent")).toBeInTheDocument();
    expect(screen.getByText("Red Team Agent")).toBeInTheDocument();
    expect(screen.getByText("Target Agent")).toBeInTheDocument();
    expect(screen.getByText("Judge Agent")).toBeInTheDocument();
    expect(screen.getByText("Defender Agent")).toBeInTheDocument();

    // Verify HMAC Verified badges for all turns
    const hmacBadges = screen.getAllByText("HMAC Verified");
    expect(hmacBadges.length).toBe(6);

    // Verify tool invocations
    expect(screen.getByText("PromptExtractor")).toBeInTheDocument();
    expect(screen.getByText("ASI01PromptSynthesizer")).toBeInTheDocument();
    expect(screen.getByText("PayloadDispatcher")).toBeInTheDocument();
    expect(screen.getByText("QueryExecutor")).toBeInTheDocument();
    expect(screen.getByText("SemanticJudge")).toBeInTheDocument();
  });

  it("renders breach detected and dynamic containment state on adversarial round 6", () => {
    render(<LiveAgentTurnCards round={6} events={round6Events} />);

    // Judge confirms breach
    expect(screen.getByText("Breach Detected")).toBeInTheDocument();
    // Defender confirms dynamic containment
    expect(screen.getByText("Contained")).toBeInTheDocument();
    expect(screen.getByText("PolicyPatchGenerator")).toBeInTheDocument();
  });

  it("expands trace on click to display cryptographic custody token and payload snippet", () => {
    render(<LiveAgentTurnCards round={1} events={round1Events} />);

    const inspectButtons = screen.getAllByRole("button", {
      name: /Inspect Trace/i,
    });
    expect(inspectButtons.length).toBeGreaterThan(0);

    // Expand the first agent's trace (Research)
    fireEvent.click(inspectButtons[0]);

    expect(
      screen.getByText("Cryptographic Custody Token:")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Target endpoint prober identified 3 guardrail classifiers/i)
    ).toBeInTheDocument();

    // Toggle hide trace
    const hideBtn = screen.getByRole("button", { name: /Hide Trace/i });
    fireEvent.click(hideBtn);

    expect(
      screen.queryByText("Cryptographic Custody Token:")
    ).not.toBeInTheDocument();
  });
});
