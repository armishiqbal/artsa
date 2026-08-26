"use client";

import { Network } from "lucide-react";
import MultiAgentTopologyGraph from "@/components/MultiAgentTopologyGraph";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";

export default function TopologyPage() {
  return (
    <PageStack>
      <PageHeader
        title="Attack Topology"
        description="Live blast-radius map from containment topology and ingest telemetry. Empty until real agent traffic arrives."
        icon={<Network className="h-5 w-5" />}
      />
      <div className="topology-canvas">
        <MultiAgentTopologyGraph />
      </div>
    </PageStack>
  );
}
