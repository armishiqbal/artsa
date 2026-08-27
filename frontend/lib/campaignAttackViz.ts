/** Build campaign attack theater visuals from Live Monitor stream events. */

import type { LiveMonitorEvent, LiveOutcome } from "@/lib/liveMonitorEvents";

export type CampaignPathNode = {
  id: "red_team" | "target" | "judge" | "defender";
  label: string;
  detail: string;
  active: boolean;
  hot: boolean;
};

export type CampaignRoundPulse = {
  round: number;
  outcome: LiveOutcome | null;
  attackType: string;
  summary: string;
};

export type CampaignAttackVizModel = {
  path: CampaignPathNode[];
  rounds: CampaignRoundPulse[];
  latestRound: number | null;
  outcomeCounts: { pass: number; fail: number; flag: number };
  hopSeries: Array<{ round: number; pass: number; fail: number; flag: number }>;
  latestAttack: string | null;
  latestVerdict: string | null;
  idle: boolean;
};

function roundKey(e: LiveMonitorEvent): number | null {
  return e.round != null && Number.isFinite(e.round) ? Number(e.round) : null;
}

/** Derive attack-launch visualization from live campaign events (oldest→newest or any order). */
export function buildCampaignAttackViz(events: LiveMonitorEvent[]): CampaignAttackVizModel {
  const chronological = [...events].sort((a, b) => a.seq - b.seq);
  const byRound = new Map<number, LiveMonitorEvent[]>();
  for (const e of chronological) {
    const r = roundKey(e);
    if (r == null) continue;
    const list = byRound.get(r) ?? [];
    list.push(e);
    byRound.set(r, list);
  }

  const rounds: CampaignRoundPulse[] = [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, evts]) => {
      const verdict = [...evts].reverse().find((e) => e.kind === "verdict");
      const attack = [...evts].reverse().find((e) => e.kind === "attack");
      return {
        round,
        outcome: verdict?.outcome ?? null,
        attackType: String(verdict?.attack_type || attack?.attack_type || "attack"),
        summary: String(verdict?.summary || attack?.summary || `Round ${round}`),
      };
    });

  const latest = chronological.length ? chronological[chronological.length - 1]! : null;
  const latestRound = latest ? roundKey(latest) : null;
  const latestBundle = latestRound != null ? byRound.get(latestRound) ?? [] : [];

  const hasAttack = latestBundle.some((e) => e.kind === "attack") || latest?.kind === "attack";
  const hasResponse = latestBundle.some((e) => e.kind === "response") || latest?.kind === "response";
  const hasVerdict = latestBundle.some((e) => e.kind === "verdict") || latest?.kind === "verdict";
  const lastOutcome = [...latestBundle].reverse().find((e) => e.kind === "verdict")?.outcome ?? null;
  const hot = lastOutcome === "fail";

  const attackEvt = [...latestBundle].reverse().find((e) => e.kind === "attack");
  const responseEvt = [...latestBundle].reverse().find((e) => e.kind === "response");
  const verdictEvt = [...latestBundle].reverse().find((e) => e.kind === "verdict");

  const path: CampaignPathNode[] = [
    {
      id: "red_team",
      label: "Red Team",
      detail: attackEvt?.attack_type?.slice(0, 42) || (hasAttack ? "launching…" : "idle"),
      active: Boolean(hasAttack || chronological.length),
      hot: latest?.kind === "attack",
    },
    {
      id: "target",
      label: "Target",
      detail: hasResponse
        ? (responseEvt?.summary?.replace(/^Target →\s*/i, "").slice(0, 42) || "responding")
        : hasAttack
          ? "awaiting…"
          : "idle",
      active: Boolean(hasResponse || (hasAttack && latest?.kind === "response")),
      hot: latest?.kind === "response",
    },
    {
      id: "judge",
      label: "Judge",
      detail: hasVerdict
        ? (verdictEvt?.summary?.replace(/^Judge →\s*/i, "").slice(0, 42) || "scoring")
        : hasResponse
          ? "scoring…"
          : "idle",
      active: Boolean(hasVerdict),
      hot: latest?.kind === "verdict" && lastOutcome === "flag",
    },
    {
      id: "defender",
      label: "Outcome",
      detail: lastOutcome
        ? lastOutcome === "pass"
          ? "BLOCKED"
          : lastOutcome === "fail"
            ? "BREACHED"
            : "FLAGGED"
        : "—",
      active: Boolean(hasVerdict),
      hot,
    },
  ];

  const outcomeCounts = { pass: 0, fail: 0, flag: 0 };
  for (const r of rounds) {
    if (r.outcome === "pass") outcomeCounts.pass += 1;
    else if (r.outcome === "fail") outcomeCounts.fail += 1;
    else if (r.outcome === "flag") outcomeCounts.flag += 1;
  }

  let pass = 0;
  let fail = 0;
  let flag = 0;
  const hopSeries = rounds.map((r) => {
    if (r.outcome === "pass") pass += 1;
    else if (r.outcome === "fail") fail += 1;
    else if (r.outcome === "flag") flag += 1;
    return { round: r.round, pass, fail, flag };
  });

  return {
    path,
    rounds,
    latestRound,
    outcomeCounts,
    hopSeries,
    latestAttack: attackEvt?.attack_type ?? rounds[rounds.length - 1]?.attackType ?? null,
    latestVerdict: verdictEvt?.summary ?? null,
    idle: chronological.length === 0,
  };
}
