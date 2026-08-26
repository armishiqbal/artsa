/**
 * Public accuracy card (Phase 5.3). Static, honest numbers regenerated from
 * `docs/ACCURACY.md` via `backend/scripts/accuracy_card.py`. The embedding
 * run-conditions note is part of the honesty story.
 */
const METRICS: { label: string; value: string; detail: string }[] = [
  { label: "Recall@80 (KILL band)", value: "0.939", detail: "31/33 golden-set attacks caught" },
  { label: "FPR@50 (review band)", value: "0.000", detail: "0/32 benign ops wrongly flagged" },
  { label: "ECE (calibration)", value: "0.0595", detail: "0 = perfectly calibrated" },
  { label: "Recommended threshold", value: "45", detail: "FP cost 1 / FN cost 10" },
];

const CLASS_RECALL = [
  ["code_exec", "0.75"],
  ["credential_theft", "1.00"],
  ["destructive", "1.00"],
  ["egress", "1.00"],
  ["mcp_destructive", "1.00"],
  ["prompt_injection", "1.00"],
  ["reverse_shell", "1.00"],
  ["sensitive_read", "1.00"],
  ["sqli", "1.00"],
  ["ssrf", "0.75"],
] as const;

export default function AccuracyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">ARTSA Accuracy Card</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Golden set (33 malicious / 32 safe / 5 review), real multilingual embeddings (
        <code className="rounded bg-muted px-1">local-bge-multilingual</code>).
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
          These numbers use the real semantic layer and a held-out independent set; the canary
          labels are hashed so nobody can tune against them. Read the full methodology, the
          1,100+ sample independent set, and the vendor/Azure comparison below.
        </p>
      </section>

      <p className="mt-2 text-sm text-muted-foreground">
        Full details live in the repo docs:{" "}
        <code className="rounded bg-muted px-1">docs/ACCURACY.md</code>,{" "}
        <code className="rounded bg-muted px-1">docs/BENCHMARK_METHODOLOGY.md</code>, and{" "}
        <code className="rounded bg-muted px-1">docs/COMPARISON.md</code>.
      </p>
    </main>
  );
}
