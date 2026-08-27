"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { OutcomeBadge } from "@/components/red-team/OutcomeBadge";
import { SecurityBoundaryViz } from "@/components/red-team/SecurityBoundaryViz";
import { Button } from "@/components/ui/button";

function RetestInner() {
  const search = useSearchParams();
  const id = search.get("id") || "RF-XXXX";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Retest · {id}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Show before → after. Resolving without a retest hides regressions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-md border border-border p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Previous test
          </h3>
          <dl className="mt-3 space-y-2 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Detection</dt>
              <dd>
                <OutcomeBadge outcome="detection_failed" />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Data boundary</dt>
              <dd>
                <OutcomeBadge outcome="risk" />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Leak</dt>
              <dd>
                <OutcomeBadge outcome="data_leaked" />
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-md border border-border p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Current test
          </h3>
          <dl className="mt-3 space-y-2 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Detection</dt>
              <dd>
                <OutcomeBadge outcome="blocked" />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Data boundary</dt>
              <dd>
                <OutcomeBadge outcome="safe" />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Leak</dt>
              <dd>
                <OutcomeBadge outcome="safe" />
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-[13px] font-medium text-[hsl(var(--severity-low))]">
            Security improved
          </p>
        </section>
      </div>

      <SecurityBoundaryViz detectionOk boundaryOk dataSafe />

      <div className="flex gap-2">
        <Button size="sm" asChild>
          <Link href="/red-team/lab">Run retest in Attack Lab</Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/red-team/findings">Back to findings</Link>
        </Button>
      </div>
    </div>
  );
}

export default function RetestPage() {
  return (
    <Suspense fallback={<p className="text-[13px] text-muted-foreground">Loading retest…</p>}>
      <RetestInner />
    </Suspense>
  );
}
