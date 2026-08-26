"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Crosshair, Swords, Target } from "lucide-react";
import { useProviders } from "@/lib/hooks/useProviders";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { buildTargetBlastGraph } from "@/lib/redTeamTargetBlast";
import { TargetBlastGraph } from "@/components/wargame/TargetBlastGraph";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function TargetsPage() {
  const { providers, loading } = useProviders();
  const { campaigns, loading: campaignsLoading } = useCampaigns();

  const blast = useMemo(
    () => buildTargetBlastGraph(providers, campaigns),
    [providers, campaigns]
  );

  return (
    <PageStack>
      <PageHeader
        title="Wargame targets"
        description="Systems under test — blast graph shows real campaigns fired at each target."
        icon={<Target className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/campaigns">Wargame</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/providers">Manage providers</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/campaigns?new=1">
                <Swords className="h-3.5 w-3.5" />
                Launch wargame
              </Link>
            </Button>
          </div>
        }
      />

      {loading || campaignsLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-[8px]" />
          <Skeleton className="h-64 rounded-[8px]" />
          <Skeleton className="h-64 rounded-[8px]" />
        </div>
      ) : providers.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No targets configured"
          description="Add a model provider to create a reusable wargame target."
          action={
            <Button asChild size="sm">
              <Link href="/admin/providers">Configure providers</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {blast.map((node) => (
              <TargetBlastGraph key={node.targetId} node={node} />
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "rounded-xl border border-[#313131] bg-[#0a0a0a] p-4",
                  p.configured && "ring-1 ring-inset ring-[#6798ff]/25"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-white">{p.name}</p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-[#7c7c7c]">
                      {p.model}
                    </p>
                  </div>
                  <Badge
                    variant={p.configured ? "success" : "secondary"}
                    className="meta-badge shrink-0"
                  >
                    {p.configured ? "Ready" : "No key"}
                  </Badge>
                </div>
                <p className="mt-2 font-mono text-[10px] uppercase text-[#454545]">
                  {p.type} · {p.id}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm" disabled={!p.configured}>
                    <Link href={`/campaigns?new=1&target=${encodeURIComponent(p.id)}`}>
                      <Crosshair className="h-3.5 w-3.5" />
                      Attack this target
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </PageStack>
  );
}
