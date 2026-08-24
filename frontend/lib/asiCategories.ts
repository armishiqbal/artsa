/**
 * OWASP Agentic Top 10 style labels (ASI01–ASI10) mapped to attack category codes.
 * Used in Red Team Console for CISO-legible category pickers.
 */

export interface AsiCategory {
  code: string;
  rank: number;
  label: string;
  short: string;
  attackCategories: string[];
}

/** Static ASI taxonomy aligned with /agentic_risk_framework.json ranks. */
export const ASI_CATEGORIES: AsiCategory[] = [
  {
    code: "ASI01",
    rank: 1,
    label: "Agent Goal Hijack",
    short: "Goal hijack",
    attackCategories: ["DPI", "IPI", "PROMPT_INJECTION"],
  },
  {
    code: "ASI02",
    rank: 2,
    label: "Tool Misuse & Exploitation",
    short: "Tool misuse",
    attackCategories: ["TPA", "PEX"],
  },
  {
    code: "ASI03",
    rank: 3,
    label: "Identity & Privilege Abuse",
    short: "Privilege abuse",
    attackCategories: ["PEX", "TPA"],
  },
  {
    code: "ASI04",
    rank: 4,
    label: "Agentic Supply Chain",
    short: "Supply chain",
    attackCategories: ["IPI", "TPA", "MSE"],
  },
  {
    code: "ASI05",
    rank: 5,
    label: "Unexpected Code Execution",
    short: "RCE / escape",
    attackCategories: ["TPA", "PEX"],
  },
  {
    code: "ASI06",
    rank: 6,
    label: "Memory & Context Poisoning",
    short: "Context poison",
    attackCategories: ["IPI", "DEX"],
  },
  {
    code: "ASI07",
    rank: 7,
    label: "Insecure Inter-Agent Trust",
    short: "Agent trust",
    attackCategories: ["DPI", "IPI"],
  },
  {
    code: "ASI08",
    rank: 8,
    label: "Cascading Failures",
    short: "Cascade",
    attackCategories: ["DOS", "OPM"],
  },
  {
    code: "ASI09",
    rank: 9,
    label: "Human-in-the-Loop Failures",
    short: "HITL bypass",
    attackCategories: ["MSE", "JBK"],
  },
  {
    code: "ASI10",
    rank: 10,
    label: "Rogue Agents",
    short: "Rogue agent",
    attackCategories: ["JBK", "SPE", "JAILBREAK", "SYSTEM_PROMPT_EXTRACTION"],
  },
];

const BY_ATTACK = new Map<string, AsiCategory>();
for (const asi of ASI_CATEGORIES) {
  for (const cat of asi.attackCategories) {
    if (!BY_ATTACK.has(cat.toUpperCase())) {
      BY_ATTACK.set(cat.toUpperCase(), asi);
    }
  }
}

export function asiForAttackCategory(category: string | undefined | null): AsiCategory | null {
  if (!category) return null;
  const key = category.toUpperCase().replace(/\s+/g, "_");
  return (
    BY_ATTACK.get(key) ??
    BY_ATTACK.get(key.split(".")[0]) ??
    null
  );
}

export function asiCodesForProfileCategories(categories: string[]): AsiCategory[] {
  const seen = new Set<string>();
  const out: AsiCategory[] = [];
  for (const cat of categories) {
    const asi = asiForAttackCategory(cat);
    if (asi && !seen.has(asi.code)) {
      seen.add(asi.code);
      out.push(asi);
    }
  }
  return out.sort((a, b) => a.rank - b.rank);
}
