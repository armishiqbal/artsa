import type { LucideIcon } from "lucide-react";
import {
  ShieldAlert,
  Flame,
  ShieldCheck,
  Database,
  Terminal,
  KeyRound,
  FileWarning,
} from "lucide-react";
import { VALIDATION_CASES, type ValidationCase } from "@/lib/getStarted";

export interface SandboxPreset {
  id: string;
  validationCaseId?: string;
  label: string;
  description: string;
  owasp: string;
  atlas: string;
  icon: LucideIcon;
  system: string;
  user: string;
}

function casePrompt(id: string): { system: string; user: string } {
  const c = VALIDATION_CASES.find((v) => v.id === id)!;
  return { system: c.system_prompt, user: c.user_input };
}

/** Presets aligned with Get Started validation cases + OWASP/MITRE tags. */
export const SANDBOX_PRESETS: SandboxPreset[] = [
  {
    id: "prompt_injection",
    validationCaseId: "prompt_injection",
    label: "Prompt injection",
    description: "Override system instructions",
    owasp: "LLM01",
    atlas: "AML.T0051",
    icon: ShieldAlert,
    ...casePrompt("prompt_injection"),
  },
  {
    id: "jailbreak",
    validationCaseId: "jailbreak",
    label: "Jailbreak",
    description: "DAN / unrestricted persona",
    owasp: "LLM01",
    atlas: "AML.T0054",
    icon: Flame,
    ...casePrompt("jailbreak"),
  },
  {
    id: "data_exfil",
    validationCaseId: "data_exfil",
    label: "Data exfiltration",
    description: "Export customer records",
    owasp: "LLM06",
    atlas: "AML.T0057",
    icon: Database,
    ...casePrompt("data_exfil"),
  },
  {
    id: "destructive_tool",
    validationCaseId: "destructive_tool",
    label: "Destructive tool",
    description: "Infrastructure destroy command",
    owasp: "LLM08",
    atlas: "AML.T0043",
    icon: Terminal,
    ...casePrompt("destructive_tool"),
  },
  {
    id: "credential_theft",
    validationCaseId: "credential_theft",
    label: "Credential theft",
    description: "Read passwd / SSH keys",
    owasp: "LLM02",
    atlas: "AML.T0052",
    icon: KeyRound,
    ...casePrompt("credential_theft"),
  },
  {
    id: "sql_injection",
    validationCaseId: "sql_injection",
    label: "SQL injection",
    description: "Malicious query in tool args",
    owasp: "LLM02",
    atlas: "AML.T0053",
    icon: FileWarning,
    ...casePrompt("sql_injection"),
  },
  {
    id: "benign_ops",
    validationCaseId: "benign_ops",
    label: "Benign baseline",
    description: "Safe business question",
    owasp: "—",
    atlas: "—",
    icon: ShieldCheck,
    ...casePrompt("benign_ops"),
  },
];

export function sandboxHrefForCase(caseDef: ValidationCase): string {
  return `/sandbox?case=${encodeURIComponent(caseDef.id)}`;
}

export function presetByCaseId(caseId: string): SandboxPreset | undefined {
  return SANDBOX_PRESETS.find((p) => p.validationCaseId === caseId || p.id === caseId);
}

export function presetById(id: string): SandboxPreset | undefined {
  return SANDBOX_PRESETS.find((p) => p.id === id);
}
