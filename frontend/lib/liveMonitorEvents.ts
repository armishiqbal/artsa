/** Live Monitor event schema — single stream, three log kinds. */

export type LiveOutcome = "pass" | "fail" | "flag";
export type LiveAgentName =
  | "research"
  | "curator"
  | "red_team"
  | "target"
  | "judge"
  | "defender";
export type LiveAgentState = "idle" | "running" | "done";

export const LIVE_AGENTS: { id: LiveAgentName; label: string }[] = [
  { id: "research", label: "Research" },
  { id: "curator", label: "Curator" },
  { id: "red_team", label: "Red Team" },
  { id: "target", label: "Target" },
  { id: "judge", label: "Judge" },
  { id: "defender", label: "Defender" },
];

export type LiveMonitorEvent = {
  type: "campaign_live";
  campaign_id: string;
  seq: number;
  ts: string;
  kind: "attack" | "response" | "verdict" | "agent_status";
  outcome: LiveOutcome | null;
  actor: string;
  round: number | null;
  attack_type: string | null;
  summary: string;
  agents?: Partial<Record<LiveAgentName, LiveAgentState>>;
  campaign_status?: string;
};

export function idleAgents(): Record<LiveAgentName, LiveAgentState> {
  return {
    research: "idle",
    curator: "idle",
    red_team: "idle",
    target: "idle",
    judge: "idle",
    defender: "idle",
  };
}

export function detectionRateFromEvents(events: LiveMonitorEvent[]): {
  rate: number | null;
  judged: number;
  passed: number;
  spark: number[];
} {
  const verdicts = events.filter((e) => e.kind === "verdict" && e.outcome);
  const spark: number[] = [];
  let passed = 0;
  verdicts.forEach((e, i) => {
    if (e.outcome === "pass") passed += 1;
    spark.push(Math.round((passed / (i + 1)) * 1000) / 10);
  });
  const judged = verdicts.length;
  return {
    rate: judged > 0 ? Math.round((passed / judged) * 1000) / 10 : null,
    judged,
    passed,
    spark,
  };
}

/** Map persisted rounds → feed events (poll / offline hydrate). */
export function eventsFromRounds(
  campaignId: string,
  rounds: Array<Record<string, unknown>>
): LiveMonitorEvent[] {
  const out: LiveMonitorEvent[] = [];
  let seq = 1;
  for (const raw of rounds) {
    const attack = (raw.attack as Record<string, unknown>) ?? {};
    const response = (raw.response as Record<string, unknown>) ?? {};
    const score = (raw.score as Record<string, unknown>) ?? {};
    const round = Number(raw.round_number ?? 0);
    const name = String(attack.name ?? "Attack");
    const cat = String(attack.category ?? "");
    const attackType = cat ? `${cat}: ${name}` : name;
    const verdict = String(score.verdict ?? "UNKNOWN");
    const outcome = verdictToOutcome(verdict);
    const resp = String(response.response ?? response.raw_response ?? "").slice(0, 120);
    const blocked = Boolean(response.blocked);
    const ts = String(raw.timestamp ?? new Date().toISOString());

    out.push({
      type: "campaign_live",
      campaign_id: campaignId,
      seq: seq++,
      ts,
      kind: "attack",
      outcome: null,
      actor: "red_team",
      round,
      attack_type: attackType,
      summary: `Red Team → Target: ${attackType}`,
    });
    out.push({
      type: "campaign_live",
      campaign_id: campaignId,
      seq: seq++,
      ts,
      kind: "response",
      outcome: null,
      actor: "target",
      round,
      attack_type: attackType,
      summary: `Target → ${resp || (blocked ? "blocked" : "response")}`,
    });
    out.push({
      type: "campaign_live",
      campaign_id: campaignId,
      seq: seq++,
      ts,
      kind: "verdict",
      outcome,
      actor: "judge",
      round,
      attack_type: attackType,
      summary: `Judge → ${verdict} (${outcome.toUpperCase()})`,
      agents: {
        research: "done",
        curator: "done",
        red_team: "done",
        target: "done",
        judge: "done",
        defender: outcome === "pass" || blocked ? "done" : "idle",
      },
    });
  }
  return out;
}

export function verdictToOutcome(verdict: string): LiveOutcome {
  const v = verdict.toUpperCase();
  if (v.includes("BLOCK") || v === "SAFE" || v === "PASS") return "pass";
  if (v.includes("SUCCESS") || v.includes("BREACH")) return "fail";
  return "flag";
}

export function formatEventTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts.slice(11, 19) || ts;
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
