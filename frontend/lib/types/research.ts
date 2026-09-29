/**
 * TypeScript Interfaces for Threat Intelligence, Research Feeds, and Curator Agent.
 */

export type ThreatSource =
  | "NIST_AI_RMF"
  | "OWASP_ASI"
  | "MITRE_ATLAS"
  | "VULNERABILITY_DISCLOSURE"
  | "NVD_LIVE";

export interface ThreatIntelligenceRecord {
  id: string;
  source: string;
  framework_id: string;
  title: string;
  description: string;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  technical_details: string;
  prerequisites: string[];
  suggested_vectors: string[];
  mitre_atlas?: string | null;
  owasp_llm?: string | null;
  tags: string[];
  timestamp: string;
}

export interface FrameworkMetrics {
  total_threats: number;
  sources: Record<string, number>;
  categories: Record<string, number>;
}

export interface SyncThreatsResult {
  status: string;
  nvd_count: number;
  mitre_atlas_count: number;
  total_ingested: number;
}

export interface AttackSeed {
  id: string;
  name: string;
  category: string;
  description?: string;
  template: string;
  variables?: Record<string, string>;
  metadata?: Record<string, any>;
  source?: string;
  tenant_id?: string;
  version?: number;
}

export interface CurateRetainedItem {
  record: ThreatIntelligenceRecord;
  preview_seeds: AttackSeed[];
}

export interface CurateDiscardedItem {
  record: ThreatIntelligenceRecord;
  rationale: string;
}

export interface TargetSurfaceConfig {
  tools: string[];
  has_database: boolean;
  has_bash: boolean;
  has_filesystem: boolean;
  has_rag: boolean;
  has_admin_tools: boolean;
  provider?: string;
  model?: string;
}

export interface CuratePreviewResult {
  total_considered: number;
  retained_count: number;
  discarded_count: number;
  retained: CurateRetainedItem[];
  discarded: CurateDiscardedItem[];
  surface: TargetSurfaceConfig;
}

export interface CuratePromoteResult {
  status: string;
  promoted_count: number;
  template_ids: string[];
  templates: AttackSeed[];
}
