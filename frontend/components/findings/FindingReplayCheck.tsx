"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { ServerFinding } from "@/lib/hooks/useFindings";

interface ReplayOutcome {
  original: { verdict: string; score: number; blocked: boolean };
  replayed: { verdict: string; score: number; blocked: boolean };
  was_breached: boolean;
  is_breached: boolean;
  mitigated: boolean;
}

function campaignRoundForFinding(source: string, findingId: string): { campaignId: string; round: number } | null {
  if (source !== "campaign") return null;
  const match = /^campaign-(.+)-r(\d+)$/.exec(findingId);
  if (!match) return null;
  const round = Number(match[2]);
  if (!Number.isSafeInteger(round) || round < 1) return null;
  return { campaignId: match[1]!, round };
}

export function FindingReplayCheck({ finding }: { finding: ServerFinding }) {
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<ReplayOutcome | null>(null);
  const [failed, setFailed] = useState(false);
  const location = useMemo(
    () => campaignRoundForFinding(finding.source, finding.id),
    [finding.id, finding.source]
  );

  const replay = useCallback(async () => {
    if (!location) return;
    setLoading(true);
    setFailed(false);
    setOutcome(null);
    const result = await fetchFromBackend<ReplayOutcome>(
      `/api/v1/campaigns/${encodeURIComponent(location.campaignId)}/rounds/${location.round}/replay`,
      { method: "POST", body: JSON.stringify({ note: "operator_finding_replay" }) }
    );
    setOutcome(result);
    setFailed(!result);
    setLoading(false);
  }, [location]);

  if (!location || finding.verdict?.toUpperCase() !== "SUCCESS") return null;

  return (
    <section aria-labelledby="local-replay-title" className="rounded-xl border border-neutral-800 bg-[#121212] p-4 space-y-3">
      <div className="flex items-start gap-3">
        <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="local-replay-title" className="text-sm font-semibold text-white">Check the stored probe again</h2>
          <p className="mt-1 text-xs leading-5 text-neutral-400">
            This replays the saved attack against ARTSA’s current local default defenses. It does not contact or retest the original external target.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 gap-2 border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white"
            disabled={loading}
            onClick={() => void replay()}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden />}
            {loading ? "Replaying…" : "Run local replay"}
          </Button>
          {failed ? <p role="status" className="mt-3 text-xs text-rose-400">Replay did not complete. Check the API connection and try again.</p> : null}
          {outcome ? (
            <div className="mt-3 rounded-lg border border-neutral-800 bg-[#181818] p-3 text-white" role="status">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden />
                {outcome.mitigated ? "Previously successful probe did not breach in this local replay" : outcome.is_breached ? "Probe still breached in this local replay" : "Replay outcome changed; review the scores below"}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs">
                <div><dt className="text-neutral-400">Original</dt><dd className="mt-1 font-medium text-white">{outcome.original.verdict} · {outcome.original.score}/10</dd></div>
                <div><dt className="text-neutral-400">Local replay</dt><dd className="mt-1 font-medium text-white">{outcome.replayed.verdict} · {outcome.replayed.score}/10</dd></div>
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
