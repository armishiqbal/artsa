"use client";

import { Network } from 'lucide-react';
import MultiAgentTopologyGraph from '@/components/MultiAgentTopologyGraph';

export default function TopologyPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-soc-text tracking-tight flex items-center gap-2.5">
          <Network className="w-6 h-6 text-soc-accent" />
          Multi-Agent Attack Topology & Contagion Graph
        </h1>
        <p className="text-sm text-soc-muted mt-1">
          Inspect Agent-Mediated Lateral Movement (AILM), inter-agent trust bridges, and MCP tool call propagation.
        </p>
      </div>

      <MultiAgentTopologyGraph />
    </div>
  );
}
