import Link from "next/link";
import { cn } from "@/lib/utils";

const TERMS = [
  {
    term: "Try once",
    def: "Send one test message and see if ARTSA blocks or allows it.",
    href: "/red-team/lab",
  },
  {
    term: "Full test",
    def: "Run many attacks in a row against your AI — like a practice drill.",
    href: "/red-team/campaigns/new",
  },
  {
    term: "Watch",
    def: "See live results as tests run — what was blocked and what got through.",
    href: "/red-team/monitor",
  },
  {
    term: "Results",
    def: "A summary of how your AI did across all tests.",
    href: "/red-team/matrix",
  },
] as const;

/** Plain-language vocabulary for non-technical users. */
export function RedTeamGlossary({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-card/60 px-3 py-2.5 sm:px-4",
        className
      )}
    >
      <p className="text-[11px] font-medium text-muted-foreground">What these words mean</p>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {TERMS.map((t) => (
          <div key={t.term} className="min-w-0">
            <dt>
              <Link
                href={t.href}
                className="text-[12px] font-medium text-foreground underline-offset-2 hover:underline"
              >
                {t.term}
              </Link>
            </dt>
            <dd className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t.def}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Three-step story strip for Lab / Campaigns. */
export function RedTeamSimpleSteps({
  steps,
  className,
}: {
  steps: Array<{ n: number; title: string; body: string }>;
  className?: string;
}) {
  return (
    <ol className={cn("grid gap-2 sm:grid-cols-3", className)}>
      {steps.map((s) => (
        <li
          key={s.n}
          className="rounded-md border border-border bg-card/70 px-3 py-2.5"
        >
          <p className="text-[11px] font-medium text-muted-foreground">Step {s.n}</p>
          <p className="mt-0.5 text-[13px] font-medium text-foreground">{s.title}</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

/** Friendly names for attack types (non-technical). */
export const FRIENDLY_TECHNIQUE: Record<string, { label: string; why: string }> = {
  "Prompt Injection": {
    label: "Trick the instructions",
    why: "Can someone make your AI ignore its rules?",
  },
  "Tool Abuse": {
    label: "Misuse tools",
    why: "Can someone force your AI to use tools it shouldn’t?",
  },
  Exfiltration: {
    label: "Steal private data",
    why: "Can someone pull secrets or customer info out?",
  },
  "Goal Drift": {
    label: "Change the goal",
    why: "Can someone push your AI off its real job?",
  },
  "Memory Attack": {
    label: "Poison memory",
    why: "Can someone plant bad info that sticks?",
  },
  Privilege: {
    label: "Gain extra access",
    why: "Can someone get powers they should not have?",
  },
  "Context Attack": {
    label: "Confuse context",
    why: "Can someone hide attacks inside other content?",
  },
};

export const FRIENDLY_STRATEGY: Record<string, string> = {
  Direct: "Straightforward",
  Obfuscated: "Disguised",
  "Multi-hop": "Step-by-step",
  "Social engineering": "Social pressure",
};

export function friendlyStatus(status: string): string {
  const s = status.toUpperCase();
  if (s === "RUNNING" || s === "PENDING") return "Running";
  if (s === "COMPLETED") return "Done";
  if (s === "FAILED" || s === "ERROR" || s === "CANCELLED") return "Failed";
  return status;
}
