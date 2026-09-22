/**
 * Public accuracy card (Phase 5.3). Static, honest numbers regenerated from
 * `docs/ACCURACY.md` via `backend/scripts/accuracy_card.py`. The embedding
 * run-conditions note is part of the honesty story.
 */
import { HumanReviewMetricsPanel } from "@/components/accuracy/HumanReviewMetricsPanel";

const METRICS: { label: string; value: string; detail: string }[] = [
  { label: "Recall@80 (KILL band)", value: "1.000", detail: "33/33 golden-set attacks caught" },
  { label: "FPR@50 (review band)", value: "0.000", detail: "0/32 benign ops wrongly flagged" },
  { label: "ECE (calibration)", value: "0.0706", detail: "0 = perfectly calibrated" },
  { label: "Recommended threshold", value: "80", detail: "FP cost 1 / FN cost 10" },
];

const CLASS_RECALL = [
  ["code_exec", "1.00"],
  ["credential_theft", "1.00"],
  ["destructive", "1.00"],
  ["egress", "1.00"],
  ["mcp_destructive", "1.00"],
  ["prompt_injection", "1.00"],
  ["reverse_shell", "1.00"],
  ["sensitive_read", "1.00"],
  ["sqli", "1.00"],
  ["ssrf", "1.00"],
] as const;

const INDEPENDENT_EVIDENCE = {
  dataset: "backend/benchmarks/independent_set.json",
  version: "2.1.2",
  curated: "2026-08-20",
  sha256: "7a90d0eb53b43629d6d3c015fc42bb2bafa0411717ff8607e40f8da1b10a6fb4",
  samples: "1,084 (632 malicious / 452 safe)",
  recall: "0.585",
  fpr: "0.029",
  unavailable: "0.000",
  latency: "144.480 ms",
  model: "local-bge-multilingual",
} as const;

export default function AccuracyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">ARTSA Accuracy Card</h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-b pb-3">
        <span><strong>Dataset:</strong> <code className="rounded bg-muted px-1">backend/benchmarks/golden_set.json</code></span>
        <span><strong>Samples:</strong> 70 (33 malicious / 32 safe / 5 review)</span>
        <span><strong>Run:</strong> <code className="rounded bg-muted px-1">hash-1024 (semantic layer disabled)</code></span>
        <span><strong>Evaluation Date:</strong> <time dateTime="2026-09-21">2026-09-21 UTC</time></span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Regenerate with <code className="rounded bg-muted px-1">backend/scripts/accuracy_card.py</code>.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {METRICS.map((m) => (
          <div key={m.label} className="rounded-lg border p-5">
            <p className="text-sm text-muted-foreground">{m.label}</p>
            <p className="mt-1 text-3xl font-semibold">{m.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{m.detail}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Per-class recall@80</h2>
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
          {CLASS_RECALL.map(([cls, recall]) => (
            <div key={cls} className="flex items-center justify-between border-b py-1.5 text-sm">
              <span className="text-muted-foreground">{cls}</span>
              <span className="font-mono">{recall}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-lg border p-5 text-sm">
        <h2 className="font-semibold">Honesty note</h2>
        <p className="mt-2 text-muted-foreground">
          These numbers are from the 70-sample golden regression set and do not prove
          generalization. The semantic layer was disabled for this run. The latest 1,084-sample
          independent diagnostic also used hash-1024 and scored 0.491 recall@80 (310/632), so
          ARTSA is not ready for a production-safety claim. A release needs the same evaluation
          with the real semantic model plus the hashed-label canary.
        </p>
      </section>

      <section className="mt-10 rounded-lg border p-5 text-sm" aria-label="Independent evaluation evidence">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-semibold">Independent evaluation evidence</h2>
            <p className="mt-1 text-muted-foreground">
              Frozen, curated generalization set with a reproducible dataset identity.
            </p>
          </div>
          <span className="rounded border px-2 py-0.5 font-mono text-[10px] uppercase text-amber-700">
            Measured semantic run
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Recall@80" value={INDEPENDENT_EVIDENCE.recall} />
          <Metric label="FPR@50" value={INDEPENDENT_EVIDENCE.fpr} />
          <Metric label="Runtime unavailable" value={INDEPENDENT_EVIDENCE.unavailable} />
          <Metric label="p99 latency" value={INDEPENDENT_EVIDENCE.latency} />
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 border-t pt-3 text-xs text-muted-foreground sm:grid-cols-2">
          <div><dt className="font-semibold text-foreground">Dataset</dt><dd>{INDEPENDENT_EVIDENCE.dataset} · v{INDEPENDENT_EVIDENCE.version}</dd></div>
          <div><dt className="font-semibold text-foreground">Samples</dt><dd>{INDEPENDENT_EVIDENCE.samples}</dd></div>
          <div><dt className="font-semibold text-foreground">Curated</dt><dd>{INDEPENDENT_EVIDENCE.curated}</dd></div>
          <div><dt className="font-semibold text-foreground">Embedding mode</dt><dd>{INDEPENDENT_EVIDENCE.model} (semantic layer configured)</dd></div>
          <div className="sm:col-span-2"><dt className="font-semibold text-foreground">Dataset SHA-256</dt><dd className="break-all font-mono">{INDEPENDENT_EVIDENCE.sha256}</dd></div>
        </dl>
        <p className="mt-3 rounded bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Measured generalization evidence is not a production-safety guarantee. The p99 latency
          exceeds the current 50 ms target, and the full per-class weaknesses are documented in
          the benchmark methodology. The prior hash-1024 diagnostic scored recall@80 0.491.
        </p>
      </section>

      <HumanReviewMetricsPanel />

      <p className="mt-2 text-sm text-muted-foreground">
        Full details live in the repo docs:{" "}
        <code className="rounded bg-muted px-1">docs/ACCURACY.md</code>,{" "}
        <code className="rounded bg-muted px-1">docs/BENCHMARK_METHODOLOGY.md</code>, and{" "}
        <code className="rounded bg-muted px-1">docs/COMPARISON.md</code>.
      </p>
    </main>
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
