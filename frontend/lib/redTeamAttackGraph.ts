import type { TranscriptTurn } from "@/lib/campaignTranscript";
import type { ResultValue } from "@/components/red-team/OutcomeBadge";
import { deriveRoundSecurity } from "@/lib/liveMonitorSecurity";

/** Enterprise kill-chain stages for agentic AI (control planes, not decorative nodes). */
export type GraphStageId =
  | "input"
  | "technique"
  | "agent"
  | "tool"
  | "data"
  | "outcome";

export type StageTone = "idle" | "contained" | "risk" | "breached";

export type GraphStageDef = {
  id: GraphStageId;
  label: string;
  control: string;
  question: string;
};

export const GRAPH_STAGES: GraphStageDef[] = [
  {
    id: "input",
    label: "Adversarial input",
    control: "Ingress / prompt gate",
    question: "Did untrusted content enter the agent loop?",
  },
  {
    id: "technique",
    label: "Technique",
    control: "Attack classification",
    question: "Which adversarial technique was exercised?",
  },
  {
    id: "agent",
    label: "Agent runtime",
    control: "Model / policy layer",
    question: "Did the agent interpret or comply with the attack?",
  },
  {
    id: "tool",
    label: "Tool & privilege",
    control: "Tool policy / RBAC",
    question: "Were tools or elevated actions invoked?",
  },
  {
    id: "data",
    label: "Data & memory",
    control: "Data boundary",
    question: "Was sensitive context or memory reachable?",
  },
  {
    id: "outcome",
    label: "Containment outcome",
    control: "Detection · Prevention · Leak",
    question: "Was the blast radius contained?",
  },
];

export type StageRoundHit = {
  turn: TranscriptTurn;
  result: ResultValue;
  detection: string;
  prevention: string;
  leak: string;
};

export type StageAggregate = {
  id: GraphStageId;
  def: GraphStageDef;
  hits: StageRoundHit[];
  tested: number;
  breached: number;
  risk: number;
  contained: number;
  tone: StageTone;
};

function stageReached(id: GraphStageId, turn: TranscriptTurn): boolean {
  switch (id) {
    case "input":
      return Boolean(turn.attackPrompt);
    case "technique":
      return Boolean(turn.attackName || turn.category);
    case "agent":
      return Boolean(turn.targetResponse || turn.targetError || turn.verdict);
    case "tool":
      return (
        Boolean(turn.category) ||
        (turn.mutationsApplied?.length ?? 0) > 0 ||
        /tool|shell|api|plugin|function/i.test(`${turn.attackName} ${turn.category} ${turn.reasoning}`)
      );
    case "data":
      return Boolean(turn.targetResponse || turn.blocked || turn.attackSuccessScore >= 0.3);
    case "outcome":
      return Boolean(turn.verdict) || turn.blocked === true;
    default:
      return false;
  }
}

function toneFor(breached: number, risk: number, tested: number): StageTone {
  if (tested === 0) return "idle";
  if (breached > 0) return "breached";
  if (risk > 0) return "risk";
  return "contained";
}

/** Aggregate campaign rounds into kill-chain stages for enterprise path analysis. */
export function buildAttackGraph(turns: TranscriptTurn[]): {
  stages: StageAggregate[];
  pathBreaches: number;
  pathRisks: number;
  pathContained: number;
  criticalLeaks: number;
} {
  const stages: StageAggregate[] = GRAPH_STAGES.map((def) => {
    const hits: StageRoundHit[] = [];
    for (const turn of turns) {
      if (!stageReached(def.id, turn)) continue;
      const axes = deriveRoundSecurity(turn);
      if (!axes) continue;
      hits.push({
        turn,
        result: axes.result,
        detection: axes.detection,
        prevention: axes.prevention,
        leak: axes.leak,
      });
    }
    const breached = hits.filter((h) => h.result === "fail" || h.result === "critical").length;
    const risk = hits.filter((h) => h.result === "risk").length;
    const contained = hits.filter((h) => h.result === "pass").length;
    return {
      id: def.id,
      def,
      hits,
      tested: hits.length,
      breached,
      risk,
      contained,
      tone: toneFor(breached, risk, hits.length),
    };
  });

  const outcomes = stages.find((s) => s.id === "outcome");
  const criticalLeaks = outcomes?.hits.filter((h) => h.leak === "confirmed").length ?? 0;

  return {
    stages,
    pathBreaches: outcomes?.breached ?? 0,
    pathRisks: outcomes?.risk ?? 0,
    pathContained: outcomes?.contained ?? 0,
    criticalLeaks,
  };
}
