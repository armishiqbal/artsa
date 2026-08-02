"use client";

import { Network } from "lucide-react";
import MultiAgentTopologyGraph from "@/components/MultiAgentTopologyGraph";
import { PageHeader } from "@/components/shared/PageHeader";

export default function TopologyPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Attack Topology"
        description="Multi-agent lateral movement, trust bridges, and MCP tool call propagation graphs."
        icon={<Network className="h-5 w-5" />}
      />
      <MultiAgentTopologyGraph />
    </div>
  );
}
