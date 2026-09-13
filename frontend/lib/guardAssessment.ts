export type AssessmentStatus = "detected" | "not_detected" | "not_evaluated";

export type GuardCategory =
  | "content_violation"
  | "data_leakage"
  | "prompt_attack"
  | "unknown_links";

export type CategoryAssessment = {
  category: GuardCategory;
  status: AssessmentStatus;
  confidence: number | null;
  action: "ALLOW" | "BLOCK" | "QUARANTINE" | null;
  detectorCount: number;
  explanation: string;
};

export type GuardAssessment = {
  schemaVersion: 1;
  runId: string;
  sessionId: string;
  phase: "input" | "output";
  outcome: "passed" | "flagged" | "approval" | "unavailable" | "cancelled";
  action: "ALLOW" | "BLOCK" | "QUARANTINE" | "UNAVAILABLE";
  riskScore: number | null;
  categories: CategoryAssessment[];
};

export type GuardRun = {
  id: string;
  submittedAt: string;
  promptPreview: string;
  status: "pending" | GuardAssessment["outcome"];
  assessment?: GuardAssessment;
  providerId?: string;
  model?: string;
  approvalId?: string;
};

export const GUARD_CATEGORIES: readonly GuardCategory[] = [
  "content_violation",
  "data_leakage",
  "prompt_attack",
  "unknown_links",
] as const;

const ASSESSMENT_STATUSES = new Set<AssessmentStatus>(["detected", "not_detected", "not_evaluated"]);
const OUTCOMES = new Set<GuardAssessment["outcome"]>(["passed", "flagged", "approval", "unavailable", "cancelled"]);
const ACTIONS = new Set<GuardAssessment["action"]>(["ALLOW", "BLOCK", "QUARANTINE", "UNAVAILABLE"]);
const CATEGORY_ACTIONS = new Set<CategoryAssessment["action"]>(["ALLOW", "BLOCK", "QUARANTINE", null]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

export function parseGuardAssessment(value: unknown, expectedRunId?: string): GuardAssessment | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
  if (typeof value.runId !== "string" || !value.runId || (expectedRunId && value.runId !== expectedRunId)) return null;
  if (typeof value.sessionId !== "string" || !value.sessionId) return null;
  if (value.phase !== "input" && value.phase !== "output") return null;
  if (!OUTCOMES.has(value.outcome as GuardAssessment["outcome"])) return null;
  if (!ACTIONS.has(value.action as GuardAssessment["action"])) return null;
  if (!isNullableFiniteNumber(value.riskScore) || !Array.isArray(value.categories)) return null;

  const seen = new Set<GuardCategory>();
  const categories: CategoryAssessment[] = [];
  for (const entry of value.categories) {
    if (!isRecord(entry) || !GUARD_CATEGORIES.includes(entry.category as GuardCategory)) return null;
    const category = entry.category as GuardCategory;
    if (seen.has(category) || !ASSESSMENT_STATUSES.has(entry.status as AssessmentStatus)) return null;
    if (!isNullableFiniteNumber(entry.confidence) || !CATEGORY_ACTIONS.has(entry.action as CategoryAssessment["action"])) return null;
    if (typeof entry.detectorCount !== "number" || !Number.isInteger(entry.detectorCount) || entry.detectorCount < 0) return null;
    if (typeof entry.explanation !== "string" || !entry.explanation) return null;
    if (entry.status === "not_evaluated" && (entry.action !== null || entry.confidence !== null || entry.detectorCount !== 0)) return null;
    if (entry.status === "detected" && entry.action === null) return null;
    seen.add(category);
    categories.push({
      category,
      status: entry.status as AssessmentStatus,
      confidence: entry.confidence,
      action: entry.action as CategoryAssessment["action"],
      detectorCount: entry.detectorCount,
      explanation: entry.explanation,
    });
  }
  if (seen.size !== GUARD_CATEGORIES.length) return null;
  const unknownLinks = categories.find((entry) => entry.category === "unknown_links");
  if (unknownLinks?.status !== "not_evaluated") return null;
  if (
    (value.outcome === "unavailable" || value.outcome === "cancelled") &&
    categories.some((entry) => entry.status !== "not_evaluated")
  ) return null;

  return {
    schemaVersion: 1,
    runId: value.runId,
    sessionId: value.sessionId,
    phase: value.phase,
    outcome: value.outcome as GuardAssessment["outcome"],
    action: value.action as GuardAssessment["action"],
    riskScore: value.riskScore,
    categories,
  };
}

export function terminalAssessment(
  runId: string,
  outcome: "unavailable" | "cancelled",
  sessionId = "local",
): GuardAssessment {
  return {
    schemaVersion: 1,
    runId,
    sessionId,
    phase: "output",
    outcome,
    action: "UNAVAILABLE",
    riskScore: null,
    categories: GUARD_CATEGORIES.map((category) => ({
      category,
      status: "not_evaluated",
      confidence: null,
      action: null,
      detectorCount: 0,
      explanation: `${category.replaceAll("_", " ")} was not evaluated for this run.`,
    })),
  };
}

export function promptPreview(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 160 ? `${compact.slice(0, 159)}…` : compact;
}
