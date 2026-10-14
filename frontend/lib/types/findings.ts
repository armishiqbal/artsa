import type { ServerFinding } from "@/lib/hooks/useFindings";

export interface ExtendedFinding extends ServerFinding {
  target_agent?: string;
  impact_score?: number;
  blast_radius?: string;
  remediation_hint?: string;
  exploit_sample?: string;
  detection_layer?: string;
  mitre_atlas?: string;
  target_model?: string;
  namespace?: string;
}
