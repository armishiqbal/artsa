import { ArrowRight, Check, CircleAlert, LockKeyhole } from "lucide-react";

/** Static, explicitly illustrative product walkthrough. It is not live telemetry. */
export function LandingHeroPreview() {
  return (
    <div className="overflow-hidden rounded-2xl bg-[var(--color-card-carbon)]">
      <div className="flex items-center justify-between border-b border-[var(--color-steel-border)] px-4 py-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-graphite)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-graphite)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-graphite)]" />
        </div>
        <span className="lp-mono text-[12px] tracking-[0.08em] text-[var(--color-ash)]">
          SECURITY DECISION / EXAMPLE
        </span>
        <span className="lp-mono rounded-full border border-[var(--color-steel-border)] px-2 py-1 text-[11px] tracking-[0.08em] text-[var(--color-ash)]">
          WALKTHROUGH
        </span>
      </div>

      <div className="p-4 sm:p-6">
        <p className="mb-5 text-[13px] text-[var(--color-fog)]">
          Sample request · illustrative policy outcome
        </p>
        <div className="lp-mono rounded-lg border border-[var(--color-steel-border)] bg-[var(--color-deep-coal)] p-4 text-[12px] sm:p-5">
          <p className="text-[var(--color-fog)]">tool_call.request</p>
          <p className="mt-3 text-[var(--color-snow)]">read_secret</p>
          <p className="mt-1 break-all text-[var(--color-ash)]">
            resource: production credentials
          </p>
        </div>

        <div className="my-5 flex items-center gap-3 text-[12px] text-[var(--color-fog)]">
          <span className="h-px flex-1 bg-[var(--color-steel-border)]" />
          policy evaluation
          <span className="h-px flex-1 bg-[var(--color-steel-border)]" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-300/20 bg-amber-300/[0.07] p-4">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
            <div>
              <p className="text-[14px] font-semibold text-[var(--color-snow)]">QUARANTINE</p>
              <p className="mt-1 text-[12px] text-[var(--color-ash)]">Held for operator review</p>
            </div>
          </div>
          <div className="lp-mono flex items-center gap-2 text-[11px] text-[var(--color-fog)]">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
            Tool result withheld
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-steel-border)] pt-4 text-[12px] text-[var(--color-fog)]">
          <span className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-[var(--color-pistachio)]" aria-hidden />
            Decision recorded for review
          </span>
          <span className="inline-flex items-center gap-1 text-[var(--color-ash)]">
            Example only <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
      </div>
    </div>
  );
}
