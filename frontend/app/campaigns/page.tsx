"use client";

import { useState, useEffect } from "react";
import { Swords, Play, Terminal, Cpu, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useProviders } from "@/lib/hooks/useProviders";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { useCampaignRun } from "@/lib/hooks/useCampaignRun";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STEPS = ["Target", "Profile", "Launch"] as const;

const ATTACK_PROFILES = [
  { id: "quick_scan", name: "Quick Scan", desc: "DPI, JBK, SPE — fast surface assessment" },
  { id: "comprehensive", name: "Comprehensive Audit", desc: "Full multi-vector red-team sweep" },
];

export default function WargamePage() {
  const { providers, loading: providersLoading } = useProviders();
  const { capabilities, loading: authLoading } = useAuthRole();
  const { isRunning, logs, campaignId, completed, launch } = useCampaignRun();
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [modelName, setModelName] = useState("");
  const [attackProfile, setAttackProfile] = useState("quick_scan");
  const [rounds, setRounds] = useState(5);
  const [baseUrl, setBaseUrl] = useState("");

  const provider = providers.find((p) => p.id === selectedProvider);

  useEffect(() => {
    if (provider && !modelName) {
      setModelName(provider.model);
    }
  }, [provider, modelName]);

  const handleProviderSelect = (pId: string) => {
    setSelectedProvider(pId);
    const found = providers.find((p) => p.id === pId);
    if (found) setModelName(found.model);
  };

  const handleLaunch = () => {
    if (!selectedProvider) return;
    void launch({
      provider: selectedProvider,
      modelName,
      attackProfile,
      rounds,
      baseUrl,
    });
  };

  const canAdvanceStep0 = !!selectedProvider;
  const canAdvanceStep1 = !!attackProfile && rounds >= 1;

  if (!authLoading && !capabilities.can_run_campaigns) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Wargame Simulation"
          description="Configure target providers, attack profiles, and execute autonomous red-team campaigns — prompt injection, jailbreak, and system prompt extraction."
          icon={<Swords className="h-5 w-5" />}
        />
        <EmptyState
          icon={Swords}
          title="Campaign access restricted"
          description="Your API key role does not include permission to launch wargame campaigns. Contact an admin for redteam or admin access."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Wargame Simulation"
        description="Configure target providers, attack profiles, and execute autonomous red-team campaigns — prompt injection, jailbreak, and system prompt extraction."
        icon={<Swords className="h-5 w-5" />}
        actions={
          isRunning ? (
            <Badge variant="info" className="animate-pulse">
              Running
            </Badge>
          ) : completed ? (
            <Badge variant="success">Completed</Badge>
          ) : null
        }
      />

      <nav aria-label="Wargame wizard steps" className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => !isRunning && setStep(i)}
              disabled={isRunning}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                step === i
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent",
                isRunning && "cursor-not-allowed opacity-60"
              )}
            >
              <span className="font-mono">{i + 1}</span>
              {label}
              {i < step && <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          {step === 0 && (
            <DashboardCard title="Step 1 · Target Provider" description="Select from configured LLM backends">
              {providersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : providers.length === 0 ? (
                <EmptyState
                  icon={Swords}
                  title="No providers available"
                  description="Configure API keys in Providers before launching a campaign."
                  action={
                    <Button asChild size="sm">
                      <Link href="/admin/providers">Configure providers</Link>
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="space-y-2">
                    {providers.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleProviderSelect(p.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                          selectedProvider === p.id
                            ? "border-primary/50 bg-primary/10 text-foreground"
                            : "border-border hover:bg-accent",
                          !p.configured && p.type !== "local" && "opacity-60"
                        )}
                      >
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">{p.model}</p>
                        </div>
                        <Badge
                          variant={p.configured ? "success" : "secondary"}
                          className="text-[10px]"
                        >
                          {p.configured ? "Ready" : "No key"}
                        </Badge>
                      </button>
                    ))}
                  </div>
                  {selectedProvider && (
                    <div className="space-y-3 border-t border-border pt-4">
                      <label className="text-xs font-medium text-muted-foreground">Model name</label>
                      <Input
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                        className="font-mono text-xs"
                      />
                      {(provider?.type === "local" || selectedProvider === "custom") && (
                        <>
                          <label className="text-xs font-medium text-muted-foreground">Base URL</label>
                          <Input
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder="http://localhost:11434/v1"
                            className="font-mono text-xs"
                          />
                        </>
                      )}
                      {!provider?.configured && provider?.type !== "local" && (
                        <p className="text-xs text-status-warning">
                          No API key configured — add it in{" "}
                          <Link href="/admin/providers" className="underline">
                            Providers
                          </Link>{" "}
                          or .env before launching.
                        </p>
                      )}
                    </div>
                  )}
                  <Button
                    className="mt-4 w-full gap-2"
                    disabled={!canAdvanceStep0}
                    onClick={() => setStep(1)}
                  >
                    Continue <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </DashboardCard>
          )}

          {step === 1 && (
            <DashboardCard title="Step 2 · Attack Profile" description="Choose campaign intensity">
              <div className="space-y-3">
                {ATTACK_PROFILES.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setAttackProfile(profile.id)}
                    className={cn(
                      "w-full rounded-lg border p-4 text-left transition-colors",
                      attackProfile === profile.id
                        ? "border-primary/50 bg-primary/10"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <p className="text-sm font-medium">{profile.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{profile.desc}</p>
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <label htmlFor="rounds" className="text-xs font-medium text-muted-foreground">
                  Max rounds: {rounds}
                </label>
                <input
                  id="rounds"
                  type="range"
                  min={1}
                  max={20}
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  className="mt-2 w-full accent-primary"
                />
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button className="flex-1 gap-2" disabled={!canAdvanceStep1} onClick={() => setStep(2)}>
                  Continue <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </DashboardCard>
          )}

          {step === 2 && (
            <DashboardCard title="Step 3 · Launch" description="Review and execute">
              <dl className="space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Provider</dt>
                  <dd>{provider?.name ?? selectedProvider}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Model</dt>
                  <dd>{modelName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Profile</dt>
                  <dd>{attackProfile}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Rounds</dt>
                  <dd>{rounds}</dd>
                </div>
              </dl>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} disabled={isRunning}>
                  Back
                </Button>
                <Button onClick={handleLaunch} disabled={isRunning} className="flex-1 gap-2">
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Executing…
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" /> Run Simulation
                    </>
                  )}
                </Button>
              </div>
              {completed && (
                <div className="mt-4 flex flex-col gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/reports">View reports</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/replay">Open replay</Link>
                  </Button>
                </div>
              )}
            </DashboardCard>
          )}
        </div>

        <DashboardCard
          title="Execution Console"
          description="Live campaign telemetry"
          className="lg:col-span-2"
          badge={<Terminal className="h-4 w-4 text-muted-foreground" aria-hidden />}
          contentClassName="flex min-h-[480px] flex-col"
        >
          <ScrollArea className="flex-1 rounded-lg border border-border bg-zinc-950 p-4 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="py-24 text-center text-muted-foreground">
                Complete the wizard steps and launch a simulation.
              </p>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "leading-relaxed",
                    log.includes("ERROR") && "font-semibold text-destructive",
                    log.includes("COMPLETE") && "font-semibold text-status-success",
                    log.includes("GATEWAY") && "text-primary",
                    !log.includes("ERROR") &&
                      !log.includes("COMPLETE") &&
                      !log.includes("GATEWAY") &&
                      "text-zinc-400"
                  )}
                >
                  {log}
                </div>
              ))
            )}
          </ScrollArea>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-mono">ID: {campaignId ?? "—"}</span>
            <span className="flex items-center gap-1">
              <Cpu className="h-3.5 w-3.5" aria-hidden />
              Evolutionary Red Team
            </span>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}
