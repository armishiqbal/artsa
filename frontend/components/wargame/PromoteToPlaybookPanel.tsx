"use client";

import { useCallback, useState } from "react";
import { BookMarked, CheckCircle2, Loader2, ShieldPlus } from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TranscriptTurn } from "@/lib/campaignTranscript";

interface PolicyRule {
  name: string;
  pattern: string;
  event_type: string;
  severity: string;
  risk_score: number;
  description?: string;
}

interface PolicySuggestion {
  suggested_rule: PolicyRule;
  already_covered: boolean;
  rationale: string;
}

interface PromoteToPlaybookPanelProps {
  turn: TranscriptTurn | null;
  findingId?: string | null;
  onPromoted?: () => void;
  className?: string;
}

/** Closed-loop action: turn a finding into a playbook rule (server-backed). */
export function PromoteToPlaybookPanel({
  turn,
  findingId,
  onPromoted,
  className,
}: PromoteToPlaybookPanelProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<PolicySuggestion | null>(null);
  const [enforced, setEnforced] = useState(false);
  const [deployedVersion, setDeployedVersion] = useState<number | null>(null);

  const suggest = useCallback(async () => {
    if (!turn) return;
    setLoading(true);
    setEnforced(false);
    setDeployedVersion(null);
    const data = await fetchFromBackend<PolicySuggestion>("/api/v1/policies/suggest", {
      method: "POST",
      body: JSON.stringify({
        content: turn.attackPrompt,
        trigger_phrases: [],
        event_type: "PROMPT_INJECTION",
        severity: turn.severity,
        risk_score: Math.min(100, Math.max(turn.attackSuccessScore * 10, 50)),
        source: `${turn.attackName} · ${turn.asiCode ?? turn.category}`,
      }),
    });
    setSuggestion(data);
    setLoading(false);
  }, [turn]);

  const enforce = useCallback(async () => {
    if (!suggestion?.suggested_rule || !turn) return;
    setLoading(true);
    const rule = suggestion.suggested_rule;

    let ok = false;
    if (findingId) {
      const res = await fetchFromBackend<{
        status?: string;
        playbook_version?: number;
      }>(`/api/v1/findings/${encodeURIComponent(findingId)}/promote`, {
        method: "POST",
        body: JSON.stringify(rule),
      });
      ok = Boolean(res?.status === "promoted");
      if (res?.playbook_version) setDeployedVersion(res.playbook_version);
    } else {
      const res = await fetchFromBackend<{ status: string; playbook_version?: number }>(
        "/api/v1/policies/rules",
        { method: "POST", body: JSON.stringify(rule) }
      );
      ok = Boolean(res);
      if (res?.playbook_version) setDeployedVersion(res.playbook_version);
    }

    setLoading(false);
    if (ok) {
      setEnforced(true);
      onPromoted?.();
    }
  }, [suggestion, turn, findingId, onPromoted]);

  return (
    <div className={className}>
      <div className="rounded-xl border border-border bg-muted/10 p-4">
        <div className="flex items-start gap-3">
          <ShieldPlus className="mt-0.5 h-5 w-5 shrink-0 text-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Promote to playbook</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Close the Research → Defender loop — creates a versioned playbook snapshot on the server.
            </p>
          </div>
        </div>

        {!turn ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Select a finding or transcript turn first.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {!suggestion && !enforced && (
              <Button
                size="sm"
                className="interactive-pill gap-2"
                disabled={loading}
                onClick={() => void suggest()}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookMarked className="h-3.5 w-3.5" />}
                Suggest rule from finding
              </Button>
            )}

            {suggestion && (
              <div className="space-y-2 rounded-lg border border-border bg-card/60 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="meta-badge font-mono">
                    {suggestion.suggested_rule.name}
                  </Badge>
                  {suggestion.already_covered && (
                    <Badge variant="secondary" className="meta-badge">
                      Already covered
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{suggestion.rationale}</p>
                <pre className="code-block overflow-x-auto p-2 font-mono text-[10px]">
                  {suggestion.suggested_rule.pattern}
                </pre>
                {!enforced && !suggestion.already_covered && (
                  <Button
                    size="sm"
                    variant="default"
                    className="interactive-pill gap-2"
                    disabled={loading}
                    onClick={() => void enforce()}
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Deploy to playbook
                  </Button>
                )}
                {enforced && (
                  <div className="flex items-center gap-2 text-status-success">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    <span>
                      Promoted
                      {deployedVersion ? ` · playbook v${deployedVersion}` : ""}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
