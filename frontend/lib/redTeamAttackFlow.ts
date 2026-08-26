/**
 * Live red-team attack-flow graph — hops driven by phase + transcript evidence only.
 * Never invents nodes from decorative pipeline chrome.
 */

import type { TranscriptTurn } from "@/lib/campaignTranscript";
import {
  attackPhases,
  type AttackPhaseId,
} from "@/lib/redTeamAttackPhase";

export type AttackFlowHopId =
  | "research"
  | "curator"
  | "redteam"
  | "target"
  | "judge"
  | "defender";

/** Edge/hop status derived from real phase or turn verdict — not cosmetics. */
export type AttackFlowStatus =
  | "pending"
  | "active"
  | "done"
  | "blocked"
  | "breached";

export interface AttackFlowHop {
  id: AttackFlowHopId;
  label: string;
  detail: string;
  status: AttackFlowStatus;
  phaseId: AttackPhaseId;
}

export interface AttackFlowEdge {
  id: string;
  from: AttackFlowHopId;
  to: AttackFlowHopId;
  label: string;
  status: AttackFlowStatus;
}

export interface AttackFlowModel {
  hops: AttackFlowHop[];
  edges: AttackFlowEdge[];
  /** Provenance for enterprise trust badge */
  source: "live-phase" | "transcript" | "idle";
  sourceLabel: string;
  activeHopId: AttackFlowHopId | null;
}

const HOP_ORDER: AttackFlowHopId[] = [
  "research",
  "curator",
  "redteam",
  "target",
  "judge",
  "defender",
];

const PHASE_TO_HOP: Record<AttackPhaseId, AttackFlowHopId> = {
  recon: "research",
  arm: "curator",
  attack: "redteam",
  respond: "target",
  judge: "judge",
  complete: "defender",
};

const EDGE_DEFS: Array<{ from: AttackFlowHopId; to: AttackFlowHopId; label: string }> = [
  { from: "research", to: "curator", label: "intel" },
  { from: "curator", to: "redteam", label: "arm" },
  { from: "redteam", to: "target", label: "probe" },
  { from: "target", to: "judge", label: "trace" },
  { from: "judge", to: "defender", label: "verdict" },
];

function phaseIndex(phase: AttackPhaseId): number {
  const hop = PHASE_TO_HOP[phase];
  return HOP_ORDER.indexOf(hop);
}

/** Infer how far a transcript turn has progressed through the chain. */
export function turnProgressIndex(turn: TranscriptTurn | null): number {
  if (!turn) return -1;
  const hasAttack = Boolean(turn.attackPrompt?.trim());
  const hasResponse = Boolean(turn.targetResponse?.trim());
  const hasVerdict = Boolean(turn.verdict && turn.verdict.toUpperCase() !== "UNKNOWN");
  if (hasVerdict && hasResponse && hasAttack) return HOP_ORDER.indexOf("judge");
  if (hasAttack && hasResponse) return HOP_ORDER.indexOf("target");
  if (hasAttack) return HOP_ORDER.indexOf("redteam");
  return HOP_ORDER.indexOf("curator");
}

export function verdictEdgeStatus(turn: TranscriptTurn | null): AttackFlowStatus {
  if (!turn) return "pending";
  const v = turn.verdict.toUpperCase();
  // Infra failure — not a defense win; keep hop "active" so UI does not look green.
  if (v.includes("ERROR") || turn.targetError) return "active";
  if (v.includes("SUCCESS") || turn.attackSuccessScore >= 7) return "breached";
  if (turn.blocked || v.includes("BLOCKED") || v.includes("FAIL")) return "blocked";
  if (v.includes("PARTIAL")) return "active";
  if (v.includes("SAFE") || v.includes("PASS")) return "blocked";
  return "done";
}

/**
 * Build the engagement attack-flow graph from live phase + optional selected turn.
 */
export function buildAttackFlowModel(input: {
  phase: AttackPhaseId;
  isRunning: boolean;
  turn: TranscriptTurn | null;
  roundsCompleted: number;
  maxRounds: number;
}): AttackFlowModel {
  const phases = attackPhases();
  const phaseByHop = new Map(
    phases.map((p) => [PHASE_TO_HOP[p.id], p] as const)
  );

  const liveIdx = phaseIndex(input.phase);
  const turnIdx = turnProgressIndex(input.turn);
  const verdictStatus = verdictEdgeStatus(input.turn);

  let source: AttackFlowModel["source"] = "idle";
  let sourceLabel = "No engagement data";
  if (input.isRunning) {
    source = "live-phase";
    sourceLabel = `Live phase · round ${input.roundsCompleted}/${input.maxRounds || "—"}`;
  } else if (input.turn) {
    source = "transcript";
    sourceLabel = `Transcript · round ${input.turn.roundNumber}`;
  } else if (input.phase === "complete") {
    source = "transcript";
    sourceLabel = "Engagement complete";
  }

  const hops: AttackFlowHop[] = HOP_ORDER.map((id, i) => {
    const phaseMeta = phaseByHop.get(id);
    let status: AttackFlowStatus = "pending";

    if (input.isRunning) {
      if (i < liveIdx) status = "done";
      else if (i === liveIdx) status = "active";
      else status = "pending";
    } else if (input.turn || input.phase === "complete") {
      const doneThrough = Math.max(turnIdx, input.phase === "complete" ? HOP_ORDER.indexOf("defender") : -1);
      if (i <= doneThrough) {
        if (id === "target" || id === "judge") {
          status = verdictStatus === "pending" ? "done" : verdictStatus;
        } else if (id === "redteam" && (verdictStatus === "breached" || verdictStatus === "blocked")) {
          status = verdictStatus === "breached" ? "breached" : "done";
        } else {
          status = "done";
        }
      } else {
        status = "pending";
      }
    }

    return {
      id,
      label: phaseMeta?.agent ?? id,
      detail: phaseMeta?.action ?? "",
      status,
      phaseId: phaseMeta?.id ?? "recon",
    };
  });

  const edges: AttackFlowEdge[] = EDGE_DEFS.map((e) => {
    const fromIdx = HOP_ORDER.indexOf(e.from);
    const toIdx = HOP_ORDER.indexOf(e.to);
    const fromHop = hops[fromIdx];
    const toHop = hops[toIdx];
    let status: AttackFlowStatus = "pending";

    if (input.isRunning) {
      if (toIdx < liveIdx) status = "done";
      else if (toIdx === liveIdx || fromIdx === liveIdx) status = "active";
    } else if (fromHop && toHop) {
      if (toHop.status === "pending" && fromHop.status === "pending") status = "pending";
      else if (e.from === "redteam" && e.to === "target") status = verdictStatus === "pending" ? toHop.status : verdictStatus;
      else if (e.from === "target" && e.to === "judge") status = verdictStatus === "pending" ? toHop.status : verdictStatus;
      else if (e.from === "judge" && e.to === "defender") {
        status = toHop.status === "pending" ? "pending" : "done";
      } else {
        status =
          fromHop.status === "pending" || toHop.status === "pending" ? "pending" : "done";
      }
    }

    return {
      id: `${e.from}->${e.to}`,
      from: e.from,
      to: e.to,
      label: e.label,
      status,
    };
  });

  const activeHop =
    hops.find((h) => h.status === "active") ??
    (input.phase === "complete" ? hops[hops.length - 1] : null);

  return {
    hops,
    edges,
    source,
    sourceLabel,
    activeHopId: activeHop?.id ?? null,
  };
}

export function hopIndex(id: AttackFlowHopId): number {
  return HOP_ORDER.indexOf(id);
}

export { HOP_ORDER, PHASE_TO_HOP };
