/** Service readiness for Red Team — real product gates, not demo chrome. */

export type ReadyCheckId = "service" | "provider" | "traffic" | "campaign";

export type ReadyCheck = {
  id: ReadyCheckId;
  label: string;
  ok: boolean;
  detail: string;
  href: string;
  cta: string;
};

export type ServiceReadyModel = {
  checks: ReadyCheck[];
  readyCount: number;
  total: number;
  /** True when service + provider are green (minimum to run real attacks). */
  canRun: boolean;
  /** True when canRun and at least one traffic or campaign signal exists. */
  shareReady: boolean;
  summary: string;
};

export function deriveRedTeamServiceReady(input: {
  apiOnline: boolean;
  providerCount: number;
  providersLoading?: boolean;
  liveEventCount: number;
  campaignCount: number;
}): ServiceReadyModel {
  const providersOk = input.providerCount > 0;
  const trafficOk = input.liveEventCount > 0;
  const campaignOk = input.campaignCount > 0;

  const checks: ReadyCheck[] = [
    {
      id: "service",
      label: "Connected",
      ok: input.apiOnline,
      detail: input.apiOnline
        ? "ARTSA is online"
        : "ARTSA is offline — start the service first",
      href: "/get-started",
      cta: "Get started",
    },
    {
      id: "provider",
      label: "Your AI connected",
      ok: providersOk,
      detail: input.providersLoading
        ? "Checking…"
        : providersOk
          ? "Ready to test against your AI"
          : "Connect your AI model so full tests can run",
      href: "/settings/integrations",
      cta: "Connect AI",
    },
    {
      id: "traffic",
      label: "Activity seen",
      ok: trafficOk,
      detail: trafficOk
        ? `${input.liveEventCount} result${input.liveEventCount === 1 ? "" : "s"} so far`
        : "No results yet — try one message in Attack Lab",
      href: "/red-team/lab",
      cta: "Try once",
    },
    {
      id: "campaign",
      label: "Full test done",
      ok: campaignOk,
      detail: campaignOk
        ? `${input.campaignCount} test${input.campaignCount === 1 ? "" : "s"} on record`
        : "No full tests yet — start one when you’re ready",
      href: "/red-team/campaigns/new",
      cta: "Start a test",
    },
  ];

  const readyCount = checks.filter((c) => c.ok).length;
  const canRun = input.apiOnline && providersOk;
  const shareReady = canRun && (trafficOk || campaignOk);

  let summary: string;
  if (shareReady) {
    summary = "You’re set — ARTSA is connected, your AI is linked, and you’ve already run a test.";
  } else if (canRun) {
    summary = "You’re ready to test. Try one message or start a full safety test.";
  } else if (!input.apiOnline) {
    summary = "ARTSA isn’t connected yet. Start the service first.";
  } else {
    summary = "Connect your AI under Settings so full tests can run for real.";
  }

  return {
    checks,
    readyCount,
    total: checks.length,
    canRun,
    shareReady,
    summary,
  };
}
