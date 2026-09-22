"use client";

import { useEffect, useState } from "react";
import { fetchFromBackend } from "@/lib/api";

type ReviewMetrics = {
  basis: "human_review";
  reviewed_cases: number;
  true_positive: number;
  false_positive: number;
  false_negative: number;
  true_negative: number;
  inconclusive: number;
  precision: number | null;
  recall: number | null;
  false_positive_rate: number | null;
  false_negative_rate: number | null;
};

function percentage(value: number | null): string {
  return value == null ? "Unavailable" : `${value.toFixed(1)}%`;
}

export function HumanReviewMetricsPanel() {
  const [metrics, setMetrics] = useState<ReviewMetrics | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchFromBackend<ReviewMetrics>("/api/v1/reviews/metrics", { silent: true }).then((result) => {
      if (active) {
        setMetrics(result);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const unavailable = !metrics || metrics.reviewed_cases === 0;
  return (
    <section className="mt-10 rounded-lg border p-5 text-sm" aria-label="Human review metrics">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-semibold">Live human-review evidence</h2>
          <p className="mt-1 text-muted-foreground">
            Tenant-scoped operator labels only; not benchmark or campaign data.
          </p>
        </div>
        <span className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
          {loaded ? "Live source" : "Loading"}
        </span>
      </div>
      {unavailable ? (
        <p className="mt-4 rounded bg-muted/50 px-3 py-2 text-muted-foreground">
          No reviewed production cases yet. Precision, recall, FP rate, and FN rate are unavailable
          until operators submit validated labels.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Reviewed cases" value={String(metrics.reviewed_cases)} />
          <Metric label="Precision" value={percentage(metrics.precision)} />
          <Metric label="Recall" value={percentage(metrics.recall)} />
          <Metric label="FP / FN rate" value={`${percentage(metrics.false_positive_rate)} / ${percentage(metrics.false_negative_rate)}`} />
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-base font-semibold">{value}</p>
    </div>
  );
}
