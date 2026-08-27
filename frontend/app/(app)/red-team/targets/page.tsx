"use client";

import Link from "next/link";
import { useProviders } from "@/lib/hooks/useProviders";
import { Button } from "@/components/ui/button";

/** Slice B stub — Targets (visible in v2 rail). */
export default function TargetsPage() {
  const { providers, loading } = useProviders();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Targets</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            What we attack — providers and endpoints.
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href="/admin/providers">Manage providers</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-[13px] text-muted-foreground">Loading…</p>
      ) : providers.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
          No targets configured.{" "}
          <Link href="/admin/providers" className="underline-offset-2 hover:underline">
            Add a provider
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {providers.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-3 py-2.5 text-[13px]">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{p.model}</p>
              </div>
              <span
                className={
                  p.configured
                    ? "text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--severity-low))]"
                    : "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                }
              >
                {p.configured ? "Ready" : "Not configured"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
