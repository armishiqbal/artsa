export interface TopologyNode {
  id: string;
  name: string;
  type: "agent" | "tool" | "datastore" | "mcp_bridge";
  trust: "low" | "medium" | "high";
  status: "SAFE" | "COMPROMISED" | "EVALUATING";
  x: number;
  y: number;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  payload: string;
  status: "COMPROMISED" | "SAFE";
}

export interface TopologyApiNode {
  id: string;
  label: string;
  type?: string;
  risk_score?: number;
  status?: string;
}

export interface TopologyApiEdge {
  source: string;
  target: string;
  type?: string;
}
