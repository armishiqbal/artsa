import { SANDBOX_PRESETS } from "@/lib/sandboxPresets";

export interface DemoScanResult {
  riskScore: number;
  verdict: "SAFE" | "SUSPICIOUS" | "BREACHED";
  recommendedAction: "ALLOW" | "QUARANTINE" | "KILL";
  latencyMs: number;
  reasoning: string;
  flags: string[];
  layers: { name: string; score: number; fired: boolean }[];
  log: string;
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+override/i,
  /dump\s+(all\s+)?(credentials|passwords)/i,
  /SELECT\s+.*password/i,
  /curl\s+.*\|\s*bash/i,
  /rm\s+-rf/i,
  /\/etc\/passwd/i,
  /DAN\s+mode/i,
  /jailbreak/i,
];

const SAFE_PATTERNS = [
  /order\s+#?\d+/i,
  /shipped/i,
  /status\s+of\s+my/i,
  /hello/i,
  /thank you/i,
];

export function runDemoScan(userInput: string, systemPrompt = ""): DemoScanResult {
  const text = `${systemPrompt}\n${userInput}`.toLowerCase();
  let risk = 8;

  for (const p of INJECTION_PATTERNS) {
    if (p.test(userInput) || p.test(systemPrompt)) risk += 22;
  }
  for (const p of SAFE_PATTERNS) {
    if (p.test(userInput)) risk -= 6;
  }

  risk = Math.max(5, Math.min(98, risk));

  const breached = risk >= 72;
  const suspicious = risk >= 45 && risk < 72;

  const verdict: DemoScanResult["verdict"] = breached
    ? "BREACHED"
    : suspicious
      ? "SUSPICIOUS"
      : "SAFE";

  const recommendedAction: DemoScanResult["recommendedAction"] = breached
    ? "QUARANTINE"
    : suspicious
      ? "QUARANTINE"
      : "ALLOW";

  const layers = [
    { name: "Rule inspector", score: breached ? 88 : 12, fired: breached },
    { name: "Semantic similarity", score: breached ? 76 : 8, fired: breached },
    { name: "Tool schema guard", score: /tool|execute|query/i.test(userInput) ? 64 : 5, fired: breached },
    { name: "Goal drift", score: suspicious ? 52 : 10, fired: suspicious || breached },
    { name: "Trajectory", score: breached ? 71 : 14, fired: breached },
  ];

  const flags = breached
    ? ["PROMPT_INJECTION", "TOOL_ABUSE", "DATA_EXFIL_RISK"]
    : suspicious
      ? ["GOAL_DRIFT"]
      : [];

  const latencyMs = 2.1 + Math.random() * 3.5;

  return {
    riskScore: Math.round(risk),
    verdict,
    recommendedAction,
    latencyMs: Math.round(latencyMs * 10) / 10,
    reasoning: breached
      ? "Multiple defense layers flagged adversarial intent — tool execution would be blocked before egress."
      : suspicious
        ? "Elevated drift score; session would be flagged for SOC review."
        : "No adversarial patterns detected across layered inspectors.",
    flags,
    layers,
    log:
      recommendedAction === "ALLOW"
        ? `✅ ALLOW in ${latencyMs.toFixed(1)}ms — schema verified, no policy violations.`
        : `🚨 ${recommendedAction} in ${latencyMs.toFixed(1)}ms — ${flags.join(", ") || "policy hit"}.`,
  };
}

export function demoPresetScan(presetId: string): DemoScanResult {
  const preset = SANDBOX_PRESETS.find((p) => p.id === presetId) ?? SANDBOX_PRESETS[0];
  return runDemoScan(preset.user, preset.system);
}

export const DEMO_FINDINGS = [
  {
    id: "F-2841",
    severity: "CRITICAL" as const,
    title: "Prompt injection via RAG context",
    source: "Red Team · campaign-07",
    status: "Promoted to playbook v3",
  },
  {
    id: "F-2836",
    severity: "HIGH" as const,
    title: "Lateral tool call to execute_system_command",
    source: "Runtime ingest",
    status: "Quarantined · autopsy ready",
  },
  {
    id: "F-2829",
    severity: "MEDIUM" as const,
    title: "Goal drift on customer-support agent",
    source: "Observatory",
    status: "Under review",
  },
];

export const DEMO_REDTEAM_CELLS = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  passed: i % 5 !== 0 && i % 7 !== 0,
}));

export const DEMO_REPLAY_LAYERS = [
  { id: "L1", label: "Schema", score: 12, ok: true },
  { id: "L2", label: "Rules", score: 88, ok: false },
  { id: "L3", label: "Semantic", score: 74, ok: false },
  { id: "L4", label: "Policy", score: 45, ok: true },
  { id: "L5", label: "Trajectory", score: 91, ok: false },
  { id: "L6", label: "Verdict", score: 94, ok: false },
];
