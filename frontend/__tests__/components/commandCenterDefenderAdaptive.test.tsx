import { describe, expect, it } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommandCenterFloor } from "@/components/command-center/CommandCenterFloor";
import { CommandCenterDetectionChart } from "@/components/command-center/CommandCenterDetectionChart";
import { DEFAULT_DETECTION_SERIES } from "@/components/command-center/prototype/liveRounds";

describe("Option 4: Frontend Command Center Visualization for Defender & Adaptive Lift", () => {
  it("renders live Defender status pill on the Command Center HUD", () => {
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
    expect(screen.getByText(/DEFENDER: CLOSED-LOOP ACTIVE/i)).toBeInTheDocument();
  });

  it("renders Defender patch notification banner and supports dismissal", () => {
    render(
      <CommandCenterFloor
        events={[]}
        campaigns={[]}
        apiOnline={true}
        wsConnected={true}
      />
    );

    // Round 1 by default does not have a patch notification
    expect(screen.queryByTestId("defender-patch-notification")).toBeNull();

    // Advance to round 2 (Shift + ArrowRight or click Next)
    const nextBtn = screen.getByRole("button", { name: /NEXT ROUND/i });
    fireEvent.click(nextBtn);

    // In Round 2, Autonomous Defender hot patch notification banner appears
    const notification = screen.getByTestId("defender-patch-notification");
    expect(notification).toBeInTheDocument();
    expect(screen.getByText(/Autonomous Defender Hot-Patch Applied/i)).toBeInTheDocument();
    expect(screen.getByText(/Playbook v5/i)).toBeInTheDocument();
    expect(screen.getByText(/Inspect Policies →/i)).toBeInTheDocument();

    // Dismissing the notification
    const dismissBtn = screen.getByRole("button", { name: /Dismiss hot-patch notification/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByTestId("defender-patch-notification")).toBeNull();
  });

  it("Detection-rate-over-time chart displays climbing Adaptive Defense and flat Static Baseline", () => {
    // Check series values: climbing vs flat
    expect(DEFAULT_DETECTION_SERIES[0]!.artsa).toBe(44);
    expect(DEFAULT_DETECTION_SERIES[DEFAULT_DETECTION_SERIES.length - 1]!.artsa).toBe(95);
    expect(DEFAULT_DETECTION_SERIES.every((p) => p.baseline === 42)).toBe(true);

    render(
      <CommandCenterDetectionChart
        series={DEFAULT_DETECTION_SERIES}
        activeRound={1}
      />
    );

    expect(screen.getByText(/DETECTION RATE OVER TIME · ARTSA vs STATIC BASELINE/i)).toBeInTheDocument();
    expect(screen.getByText(/adaptive · climbing defense/i)).toBeInTheDocument();
    expect(screen.getByText(/baseline · flat static/i)).toBeInTheDocument();
    expect(screen.getByText(/lift \+53pp/i)).toBeInTheDocument();
  });
});
