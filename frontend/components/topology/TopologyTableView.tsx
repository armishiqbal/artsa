"use client";

import { Badge } from "@/components/ui/badge";
import type { TopologyNode } from "./types";

interface TopologyTableViewProps {
  nodes: TopologyNode[];
  onSelectNode: (node: TopologyNode) => void;
}

export default function TopologyTableView({ nodes, onSelectNode }: TopologyTableViewProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-muted/30">
          <tr>
            <th className="px-3 py-2 font-medium">Node</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Trust</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => (
            <tr
              key={n.id}
              className="cursor-pointer border-b border-border/50 hover:bg-muted/20"
              onClick={() => onSelectNode(n)}
            >
              <td className="px-3 py-2 font-mono">{n.name}</td>
              <td className="px-3 py-2 text-muted-foreground">{n.type}</td>
              <td className="px-3 py-2">
                <Badge variant={n.status === "COMPROMISED" ? "critical" : "success"} className="text-[10px]">
                  {n.status}
                </Badge>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{n.trust}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
