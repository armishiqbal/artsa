/**
 * Plain-language verdict summaries.
 *
 * Turns a containment verdict / risk score into a non-expert-friendly
 * "what happened / why it matters / what we did" summary, plus a compliance
 * mapping to OWASP LLM Top 10 and MITRE ATLAS. Used by the onboarding wizard
 * and the alerts inbox so every finding reads the same way across the product.
 */

import { severityFromScore, type SeverityLabel } from "@/lib/severity";

export type Verdict = "SAFE" | "SUSPICIOUS" | "BREACHED" | string;

export interface ComplianceMapping {
  owasp: string;
  atlas: string;
}

export interface VerdictSummary {
  /** Short verdict label to show as a badge. */
  label: string;
  /** One line: what the AI tried / what was detected. */
  whatHappened: string;
  /** One line: why a non-expert should care. */
  whyItMatters: string;
  /** One line: the action ARTSA took. */
  whatWeDid: string;
  severity: SeverityLabel;
  /** true when the action was blocked / contained. */
  blocked: boolean;
}

/**
 * Coarse OWASP LLM Top 10 / MITRE ATLAS mapping keyed by detector or category.
 * Falls back to the most common prompt-injection mapping.
 */
const COMPLIANCE_BY_KEY: Record<string, ComplianceMapping> = {
  prompt_injection: { owasp: "LLM01: Prompt Injection", atlas: "AML.T0051: LLM Prompt Injection" },
  jailbreak: { owasp: "LLM01: Prompt Injection", atlas: "AML.T0054: LLM Jailbreak" },
  system_prompt_leak: {
    owasp: "LLM07: System Prompt Leakage",
    atlas: "AML.T0056: Meta Prompt Extraction",
  },
  data_extraction: {
    owasp: "LLM06: Sensitive Information Disclosure",
    atlas: "AML.T0057: LLM Data Leakage",
  },
  goal_drift: { owasp: "LLM08: Excessive Agency", atlas: "AML.T0053: LLM Plugin Compromise" },
  semantic: { owasp: "LLM01: Prompt Injection", atlas: "AML.T0051: LLM Prompt Injection" },
};

const DEFAULT_MAPPING: ComplianceMapping = COMPLIANCE_BY_KEY.prompt_injection;

export function complianceMapping(key?: string | null): ComplianceMapping {
  if (!key) return DEFAULT_MAPPING;
  const normalized = key.toLowerCase();
  return COMPLIANCE_BY_KEY[normalized] ?? DEFAULT_MAPPING;
}

/** Normalize a mixed verdict/score into a plain-language summary. */
export function verdictSummary(params: {
  verdict?: Verdict;
  riskScore: number;
  recommendedAction?: string | null;
  detector?: string | null;
}): VerdictSummary {
  const { verdict, riskScore, recommendedAction } = params;
  const severity = severityFromScore(riskScore);
  const normalizedVerdict = (verdict ?? severityToVerdict(severity)).toUpperCase();
  const blocked =
    normalizedVerdict === "BREACHED" ||
    severity === "CRITICAL" ||
    ["KILL", "QUARANTINE", "BLOCK"].includes((recommendedAction ?? "").toUpperCase());

  if (normalizedVerdict === "SAFE" || severity === "LOW") {
    return {
      label: "Safe",
      whatHappened: "The request was inspected and looked like normal, expected activity.",
      whyItMatters: "No sign of manipulation, data leakage, or unsafe agent behavior.",
      whatWeDid: "Allowed the AI to proceed. No action needed.",
      severity,
      blocked: false,
    };
  }

  if (normalizedVerdict === "SUSPICIOUS" || severity === "MEDIUM" || severity === "HIGH") {
    return {
      label: "Suspicious",
      whatHappened:
        "The request looks like an attempt to trick the AI into breaking its rules.",
      whyItMatters:
        "If it succeeded, the AI could leak secrets, ignore safety rules, or take an unsafe action.",
      whatWeDid: blocked
        ? "Blocked the request and raised an alert for your team."
        : "Flagged the request for review and raised an alert for your team.",
      severity,
      blocked,
    };
  }

  // BREACHED / CRITICAL
  return {
    label: "Blocked",
    whatHappened: "A high-risk attack on the AI was detected.",
    whyItMatters:
      "Left unchecked this could have leaked sensitive data or let the AI take a harmful action.",
    whatWeDid: "Blocked the action instantly and quarantined the session. Your team was alerted.",
    severity,
    blocked: true,
  };
}

function severityToVerdict(severity: SeverityLabel): Verdict {
  if (severity === "CRITICAL") return "BREACHED";
  if (severity === "HIGH" || severity === "MEDIUM") return "SUSPICIOUS";
  return "SAFE";
}
