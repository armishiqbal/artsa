/** Risk score bands — mirror backend `src.core.severity`.

Display severity and containment verdicts share the same cutovers:
  CRITICAL / BREACHED  ≥ 80
  HIGH / SUSPICIOUS    ≥ 50
  MEDIUM               ≥ 40
  LOW                  < 40
*/

export type SeverityLabel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const CRITICAL_RISK_THRESHOLD = 80;
/** Aligns with containment SUSPICIOUS / QUARANTINE band. */
export const HIGH_RISK_THRESHOLD = 50;
export const MEDIUM_RISK_THRESHOLD = 40;
/** Alias used by engine docs / SDK. */
export const SUSPICIOUS_RISK_THRESHOLD = HIGH_RISK_THRESHOLD;

export function severityFromScore(score: number): SeverityLabel {
  if (score >= CRITICAL_RISK_THRESHOLD) return "CRITICAL";
  if (score >= HIGH_RISK_THRESHOLD) return "HIGH";
  if (score >= MEDIUM_RISK_THRESHOLD) return "MEDIUM";
  return "LOW";
}

/** Badge variant for numeric risk scores (RiskScore component). */
export function riskScoreBadgeVariant(score: number): "critical" | "warning" | "secondary" | "success" {
  const severity = severityFromScore(score);
  if (severity === "CRITICAL") return "critical";
  if (severity === "HIGH") return "warning";
  if (severity === "MEDIUM") return "secondary";
  return "success";
}
