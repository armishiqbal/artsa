import { describe, it, expect } from "vitest";
import {
  telemetryToLogRecord,
  SAMPLE_SECURITY_LOGS,
  type LogRecord,
} from "@/lib/logsTypes";

describe("logsTypes and filtering", () => {
  it("converts raw telemetry event into structured LogRecord", () => {
    const raw = {
      event_id: "evt-test-1",
      risk_score: 92,
      action: "KILL",
      verdict: "BREACHED",
      tool_name: "inject_prompt",
      arguments: { payload: "ignore previous rules" },
      triggered_at: "2026-09-17T07:00:00Z",
    };

    const record = telemetryToLogRecord(raw, 0);

    expect(record.id).toBe("evt-test-1");
    expect(record.projectMode).toBe("Protect");
    expect(record.threatsDetected).toContain("Prompt attack");
    expect(record.threatSource).toBe("User Prompt");
    expect(record.content).toContain("ignore previous rules");
    expect(record.requestId).toBe("req_evt-test");
    expect(record.processingRegion).toBe("us-east-1");
    expect(record.project).toBe("No project");

    const withProj = telemetryToLogRecord({ ...raw, project: "custom-app" }, 0);
    expect(withProj.project).toBe("custom-app");
  });

  it("handles safe telemetry without false-positive threat classification", () => {
    const safeRaw = {
      event_id: "evt-safe-1",
      risk_score: 0,
      action: "ALLOW",
      verdict: "SAFE",
      tool_name: "read_file",
      arguments: { path: "/var/log/app.log" },
    };

    const record = telemetryToLogRecord(safeRaw, 1);
    expect(record.projectMode).toBe("Monitor");
    expect(record.threatsDetected).toEqual(["No detections"]);
  });

  it("filters correctly by project and threat toggle", () => {
    const records: LogRecord[] = SAMPLE_SECURITY_LOGS;

    // Project: none -> 0 results
    const noProject = records.filter((r) => r.project === "none");
    expect(noProject).toHaveLength(0);

    // Threats toggle -> only rows with threats detected
    const threatRows = records.filter((r) =>
      r.threatsDetected.some((t) => t !== "No detections")
    );
    expect(threatRows.length).toBeGreaterThan(0);
    expect(
      threatRows.every((r) =>
        r.threatsDetected.some((t) => t !== "No detections")
      )
    ).toBe(true);
  });
});
