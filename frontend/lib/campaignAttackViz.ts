/** Build campaign attack theater visuals from Live Monitor stream events. */

import type { LiveMonitorEvent, LiveOutcome } from "@/lib/liveMonitorEvents";

export type CampaignPathNode = {
  id: "research" | "curator" | "red_team" | "target" | "judge" | "defender";
  label: string;
  role?: string;
  detail: string;
  active: boolean;
  hot: boolean;
  hmacVerified?: boolean;
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

  const researchEvt = [...latestBundle].reverse().find((e) => e.actor === "research" || e.attack_type === "reconnaissance");
  const curatorEvt = [...latestBundle].reverse().find((e) => e.actor === "curator" || e.attack_type === "curation");
  const attackEvt = [...latestBundle].reverse().find((e) => e.kind === "attack" || e.actor === "red_team");
  const responseEvt = [...latestBundle].reverse().find((e) => e.kind === "response" || e.actor === "target");
  const verdictEvt = [...latestBundle].reverse().find((e) => e.kind === "verdict" || e.actor === "judge");
  const defenderEvt = [...latestBundle].reverse().find((e) => e.actor === "defender" || e.attack_type === "containment");

  const hasResearch = Boolean(researchEvt || latest?.actor === "research");
  const hasCurator = Boolean(curatorEvt || latest?.actor === "curator");
  const hasAttack = Boolean(attackEvt || latest?.kind === "attack");
  const hasResponse = Boolean(responseEvt || latest?.kind === "response");
  const hasVerdict = Boolean(verdictEvt || latest?.kind === "verdict");
  const hasDefender = Boolean(defenderEvt || latest?.actor === "defender");
  const lastOutcome = verdictEvt?.outcome ?? [...latestBundle].reverse().find((e) => e.kind === "verdict")?.outcome ?? null;
  const hot = lastOutcome === "fail";

  const path: CampaignPathNode[] = [
    {
      id: "research",
      label: "Research",
      role: "Recon",
      detail: researchEvt?.summary?.replace(/^ResearchAgent\s*/i, "").slice(0, 36) || (hasResearch ? "enumerating…" : "idle"),
      active: Boolean(hasResearch || chronological.length),
      hot: latest?.actor === "research",
      hmacVerified: Boolean(researchEvt?.hmac_token),
    },
    {
      id: "curator",
      label: "Curator",
      role: "Payloads",
      detail: curatorEvt?.summary?.replace(/^CuratorAgent\s*/i, "").slice(0, 36) || (hasCurator ? "synthesizing…" : "idle"),
      active: Boolean(hasCurator || (hasResearch && chronological.length)),
      hot: latest?.actor === "curator",
      hmacVerified: Boolean(curatorEvt?.hmac_token),
    },
    {
      id: "red_team",
      label: "Red Team",
      role: "Exploit",
      detail: attackEvt?.attack_type?.slice(0, 36) || (hasAttack ? "launching…" : "idle"),
      active: Boolean(hasAttack || chronological.length),
      hot: latest?.kind === "attack",
      hmacVerified: Boolean(attackEvt?.hmac_token),
    },
    {
      id: "target",
      label: "Target",
      role: "SUT",
      detail: hasResponse
        ? (responseEvt?.summary?.replace(/^TargetAgent\s*/i, "").replace(/^Target →\s*/i, "").slice(0, 36) || "responding")
        : hasAttack
          ? "evaluating…"
          : "idle",
      active: Boolean(hasResponse || (hasAttack && latest?.kind === "response")),
      hot: latest?.kind === "response",
      hmacVerified: Boolean(responseEvt?.hmac_token),
    },
    {
      id: "judge",
      label: "Judge",
      role: "Evaluator",
      detail: hasVerdict
        ? (verdictEvt?.summary?.replace(/^JudgeAgent\s*/i, "").replace(/^Judge →\s*/i, "").slice(0, 36) || "scoring")
        : hasResponse
          ? "scoring…"
          : "idle",
      active: Boolean(hasVerdict),
      hot: latest?.kind === "verdict" && (lastOutcome === "flag" || lastOutcome === "fail"),
      hmacVerified: Boolean(verdictEvt?.hmac_token),
    },
    {
      id: "defender",
      label: "Defender",
      role: "Containment",
      detail: defenderEvt?.summary?.replace(/^DefenderAgent\s*/i, "").slice(0, 36) || (lastOutcome
        ? lastOutcome === "pass"
          ? "BLOCKED"
          : lastOutcome === "fail"
            ? "BREACHED"
            : "FLAGGED"
        : "—"),
      active: Boolean(hasDefender || hasVerdict),
      hot,
      hmacVerified: Boolean(defenderEvt?.hmac_token),
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
