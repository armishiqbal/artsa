import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DEFAULT_SESSIONS, DEFAULT_TIMELINES } from "../fixtures/replayFixtures";
import { IncidentInvestigationHeader } from "@/components/replay/IncidentInvestigationHeader";
import { AttackPathTimeline } from "@/components/replay/AttackPathTimeline";
import { ForensicEvidenceWorkbench } from "@/components/replay/ForensicEvidenceWorkbench";
import { AttackGraphVisualizer } from "@/components/replay/AttackGraphVisualizer";
import { ContainmentExecutionModal } from "@/components/replay/ContainmentExecutionModal";
import { ActivityAuditSummaryBar } from "@/components/replay/ActivityAuditSummaryBar";
import { ActivityEventDrawer } from "@/components/replay/ActivityEventDrawer";
import type { EvaluationView } from "@/components/replay/ReplayEventInspector";

const session = DEFAULT_SESSIONS[0]!;
const timeline = DEFAULT_TIMELINES[session.id]!;
const breachTurn = timeline.find((turn) => turn.evaluation?.verdict === "BREACHED")!;

const hops = timeline.map((turn, index) => ({
  index,
  toolName: turn.event.tool_name,
  risk:
    typeof turn.evaluation?.risk_score === "number"
      ? turn.evaluation.risk_score
      : null,
  verdict: String(turn.evaluation?.verdict ?? "UNCLASSIFIED"),
  timestamp: turn.event.timestamp,
  latency_ms: turn.event.latency_ms,
}));

describe("ARTSA evidence-backed replay views", () => {
  it("does not invent cloud or taxonomy context when a session has none", () => {
    render(
      <IncidentInvestigationHeader
        sessions={[]}
        selectedSession={undefined}
        selectedSessionId={null}
        onSelectSession={vi.fn()}
        peakRisk={0}
        breachedCount={0}
        eventCount={0}
        onExport={vi.fn()}
        exportDisabled
        actionLoading={false}
        onQuarantine={vi.fn()}
        onKill={vi.fn()}
      />
    );

    expect(screen.getByText("NO SESSION")).toBeInTheDocument();
    expect(screen.queryByText(/AWS EKS|MITRE ATLAS|Aurora DB|AWS IAM IMDS/i)).not.toBeInTheDocument();
  });

  it("renders only stored timeline evidence and leaves absent risk unscored", () => {
    render(<AttackPathTimeline hops={hops} selectedIndex={2} onSelectHop={vi.fn()} />);

    expect(screen.getByText("Attack Path Execution Chain")).toBeInTheDocument();
    expect(screen.getByText("exec_system_shell")).toBeInTheDocument();
    expect(screen.queryByText(/Risk: 0/)).not.toBeInTheDocument();
  });

  it("shows the backend event and evaluation without invented SLA or confidence values", () => {
    render(
      <ForensicEvidenceWorkbench
        event={breachTurn.event}
        evaluation={breachTurn.evaluation as EvaluationView}
        hopIndex={2}
        totalHops={timeline.length}
        showDiff={false}
        onToggleDiff={vi.fn()}
      />
    );

    expect(screen.getByText("exec_system_shell")).toBeInTheDocument();
    expect(screen.getByText("Risk: 94/100")).toBeInTheDocument();
    expect(screen.getByText("Backend evaluation record")).toBeInTheDocument();
    expect(screen.queryByText(/99\.4%|42ms|AML\.T0054/)).not.toBeInTheDocument();
  });

  it("builds the graph from a session and stored hops without asserting unrelated assets", () => {
    render(
      <AttackGraphVisualizer
        hops={hops}
        selectedIndex={2}
        onSelectHop={vi.fn()}
        session={session}
      />
    );

    expect(screen.getByText("Recorded Session Event Path")).toBeInTheDocument();
    expect(screen.getByText(session.agent_id)).toBeInTheDocument();
    expect(screen.getAllByText(/exec_system_shell/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/AWS IMDSv1|IAM Worker Credentials|rag-prod/)).not.toBeInTheDocument();
  });

  it("shows only backend-confirmed containment results", () => {
    render(
      <ContainmentExecutionModal
        isOpen
        onClose={vi.fn()}
        actionType="KILL"
        agentId={session.agent_id}
        sessionId={session.id}
        state="confirmed"
        backendStatus="BREACHED"
      />
    );

    expect(screen.getByText("Backend confirmed kill.")).toBeInTheDocument();
    expect(screen.getByText("Session status: BREACHED")).toBeInTheDocument();
    expect(screen.queryByText(/AWS credential tokens|100% Enforced|PID:/)).not.toBeInTheDocument();
  });

  it("labels session summary metrics as stored evidence and omits unsupported SLA claims", () => {
    render(
      <ActivityAuditSummaryBar
        session={session}
        totalEvents={timeline.length}
        breachedEvents={1}
        peakRisk={94}
        onQuarantine={vi.fn()}
        onKill={vi.fn()}
        actionLoading={false}
      />
    );

    expect(screen.getByText("Stored Breach Verdicts")).toBeInTheDocument();
    expect(screen.getByText("Maximum Recorded Risk")).toBeInTheDocument();
    expect(screen.queryByText(/Containment SLA|eBPF sandbox kills|Zero production penalty/)).not.toBeInTheDocument();
  });

  it("renders event arguments and evaluation from the selected record only", () => {
    render(
      <ActivityEventDrawer
        isOpen
        onClose={vi.fn()}
        entry={breachTurn}
        onQuarantine={vi.fn()}
        onKill={vi.fn()}
      />
    );

    expect(screen.getByText("exec_system_shell")).toBeInTheDocument();
    expect(screen.getByText("Recorded tool arguments")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Evaluation" }));
    expect(screen.getByText("Backend evaluation record")).toBeInTheDocument();
    expect(screen.queryByText(/Kubernetes Namespace|Aurora PostgreSQL|P99 <42ms|L4 eBPF/)).not.toBeInTheDocument();
  });
});
