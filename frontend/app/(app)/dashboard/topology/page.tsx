"use client";

import { Network, Crosshair, ScrollText } from "lucide-react";
import Link from "next/link";
import MultiAgentTopologyGraph from "@/components/MultiAgentTopologyGraph";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";
import { Button } from "@/components/ui/button";

export default function TopologyPage() {
  return (
    <PageStack>
      <PageHeader
        title="Attack Topology"
        description="Multi-agent lateral movement, trust bridges, and MCP tool call propagation graphs. Click a node when the graph is live to inspect the session."
        icon={<Network className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/logs">
                <ScrollText className="h-3.5 w-3.5" />
                Activity log
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sandbox">
                <Crosshair className="h-3.5 w-3.5" />
                Attack sandbox
              </Link>
            </Button>
          </div>
        }
      />
      <div className="topology-canvas">
        <MultiAgentTopologyGraph />
      </div>
    </PageStack>
  );
}
