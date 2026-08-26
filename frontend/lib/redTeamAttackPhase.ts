/**
 * Live red-team phase — what the adversarial agents are doing during a run.
 */

export type AttackPhaseId =
  | "recon"
  | "arm"
  | "attack"
  | "respond"
  | "judge"
  | "complete";

export interface AttackPhase {
  id: AttackPhaseId;
  agent: string;
  action: string;
}

const PHASES: AttackPhase[] = [
  { id: "recon", agent: "Research", action: "Profiling target attack surface" },
  { id: "arm", agent: "Curator", action: "Selecting & mutating probes" },
  { id: "attack", agent: "Red Team", action: "Delivering adversarial prompt" },
  { id: "respond", agent: "Target", action: "Model under test responding" },
  { id: "judge", agent: "Judge", action: "Scoring success / defense" },
  { id: "complete", agent: "Defender", action: "Packaging findings for containment" },
];

export function attackPhases(): AttackPhase[] {
  return PHASES;
}

export interface DeriveAttackPhaseInput {
  isRunning: boolean;
  completed: boolean;
  roundsCompleted: number;
  maxRounds: number;
  hasTurns: boolean;
  /** Prefer transcript evidence when inspecting a round. */
  turn?: {
    attackPrompt?: string;
    targetResponse?: string;
    verdict?: string;
  } | null;
}

/** Map run progress + optional turn evidence onto the live adversarial phase. */
export function deriveAttackPhase(input: DeriveAttackPhaseInput): AttackPhaseId {
  if (input.completed || (input.hasTurns && !input.isRunning)) return "complete";

  const turn = input.turn;
  if (turn) {
    const hasAttack = Boolean(turn.attackPrompt?.trim());
    const hasResponse = Boolean(turn.targetResponse?.trim());
    const hasVerdict = Boolean(turn.verdict && turn.verdict.toUpperCase() !== "UNKNOWN");

    if (input.isRunning) {
      if (hasAttack && !hasResponse) return "respond";
      if (hasAttack && hasResponse && !hasVerdict) return "judge";
      if (hasAttack && hasResponse && hasVerdict) {
        const max = Math.max(1, input.maxRounds);
        if (input.roundsCompleted >= max) return "judge";
        return "arm";
      }
    }
  }

  if (!input.isRunning) return "recon";
  if (input.roundsCompleted <= 0) return input.hasTurns ? "attack" : "arm";
  const max = Math.max(1, input.maxRounds);
  if (input.roundsCompleted >= max) return "judge";
  const tick = input.roundsCompleted % 3;
  if (tick === 0) return "attack";
  if (tick === 1) return "respond";
  return "judge";
}
