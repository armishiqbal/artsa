import {
  exportSecurityLog,
  filterSecurityRows,
  normalizeContainmentAction,
  toSecurityLogRows,
  toSiemRecord,
} from "@/lib/securityLog";
import type { TelemetryEvent } from "@/components/shared/LiveTelemetryStream";

describe("securityLog", () => {
  it("normalizes containment actions from mixed fields", () => {
    expect(normalizeContainmentAction("KILL", "")).toBe("KILL");
    expect(normalizeContainmentAction("", "BREACHED")).toBe("KILL");
    expect(normalizeContainmentAction("quarantine", "SUSPICIOUS")).toBe("QUARANTINE");
    expect(normalizeContainmentAction("allow", "SAFE")).toBe("ALLOW");
  });

  it("builds rows and filters by severity, action, and query", () => {
    const events: TelemetryEvent[] = [
      {
        event_id: "e1",
        agent_id: "scout",
        tool_name: "query_db",
        risk_score: 88,
        verdict: "BREACHED",
        action: "KILL",
        session_id: "sess-a",
        triggered_at: "2026-01-02T10:00:00Z",
      },
      {
        event_id: "e2",
        agent_id: "writer",
        tool_name: "write_file",
        risk_score: 12,
        verdict: "SAFE",
        action: "ALLOW",
        session_id: "sess-b",
        triggered_at: "2026-01-02T11:00:00Z",
      },
    ];
    const rows = toSecurityLogRows(events);
    expect(rows[0]?.severity).toBe("CRITICAL");
    expect(rows[0]?.action).toBe("KILL");

    const critical = filterSecurityRows(rows, {
      query: "",
      severity: "CRITICAL",
      action: "all",
    });
    expect(critical).toHaveLength(1);
    expect(critical[0]?.id).toBe("e1");

    const byAgent = filterSecurityRows(rows, {
      query: "writer",
      severity: "all",
      action: "ALLOW",
    });
    expect(byAgent).toHaveLength(1);
    expect(byAgent[0]?.tool).toBe("write_file");
  });

  it("exports SIEM-safe records without argument blobs", () => {
    const rows = toSecurityLogRows([
      {
        event_id: "e1",
        agent_id: "scout",
        tool_name: "shell",
        risk_score: 70,
        verdict: "SUSPICIOUS",
        action: "QUARANTINE",
        session_id: "s1",
        triggered_at: "2026-01-02T10:00:00Z",
        arguments: { cmd: "rm -rf /" },
      },
    ]);
    const siem = toSiemRecord(rows[0]!);
    expect(siem).not.toHaveProperty("arguments");
    expect(siem.containment_action).toBe("QUARANTINE");
    expect(siem.product).toBe("ARTSA");

    const csv = exportSecurityLog(rows, "csv");
    expect(csv.filename).toMatch(/\.csv$/);
    expect(csv.body).toContain("event_id,timestamp");
    expect(csv.body).not.toContain("rm -rf");

    const ndjson = exportSecurityLog(rows, "ndjson");
    expect(ndjson.body.split("\n")).toHaveLength(1);
  });
});
