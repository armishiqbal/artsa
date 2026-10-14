import { describe, expect, it } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommandCenterFloor } from "@/components/command-center/CommandCenterFloor";
import { CommandCenterDetectionChart } from "@/components/command-center/CommandCenterDetectionChart";
import { DEFAULT_DETECTION_SERIES } from "@/components/command-center/prototype/liveRounds";

describe("Option 4: Frontend Command Center Visualization for Defender & Adaptive Lift", () => {
  it("labels the seeded Defender state as a walkthrough without claiming a live action", () => {
    render(
      <CommandCenterFloor
        events={[]}
        campaigns={[]}
        apiOnline={true}
        wsConnected={true}
      />
    );

    const pill = screen.getByTestId("defender-status-pill");
    expect(pill).toBeInTheDocument();
    expect(screen.getByText(/WALKTHROUGH · NO DEFENDER ACTION/i)).toBeInTheDocument();
    expect(screen.queryByText(/CLOSED-LOOP ACTIVE/i)).not.toBeInTheDocument();
  });

  it("does not report a patch for an unconnected walkthrough round", () => {
    render(
      <CommandCenterFloor
        events={[]}
        campaigns={[]}
        apiOnline={true}
        wsConnected={true}
      />
    );

    const nextBtn = screen.getByRole("button", { name: /NEXT SAMPLE/i });
    fireEvent.click(nextBtn);

    expect(screen.queryByTestId("defender-patch-notification")).toBeNull();
    expect(screen.queryByText(/Autonomous Defender Hot-Patch Applied/i)).not.toBeInTheDocument();
  }, 15000);

  it("labels seeded detection points as a walkthrough sample", () => {
    render(
      <CommandCenterDetectionChart
        series={DEFAULT_DETECTION_SERIES}
        activeRound={1}
        dataMode="WALKTHROUGH"
      />
    );

    expect(screen.getByText("DETECTION RATE HISTORY")).toBeInTheDocument();
    expect(screen.getByText("Walkthrough sample")).toBeInTheDocument();
    expect(screen.queryByText(/lift \+53pp/i)).not.toBeInTheDocument();
  });
});
