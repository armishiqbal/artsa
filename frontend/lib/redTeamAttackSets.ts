/** Map Red Team UI attack sets / matrix → backend AttackCategory codes. */

export const ATTACK_SET_TO_CATEGORIES: Record<string, string[]> = {
  "Prompt Injection": ["DPI", "JBK"],
  "Tool Abuse": ["PEX"],
  "Data Exfiltration": ["DEX", "SPE"],
  "Goal Manipulation": ["MSE"],
  "Memory Poisoning": ["IPI"],
  // Lab / matrix aliases
  Exfiltration: ["DEX", "SPE"],
  "Goal Drift": ["MSE"],
  "Memory Attack": ["IPI"],
  Privilege: ["PEX"],
  "Context Attack": ["IPI", "DPI"],
  Injection: ["DPI", "JBK"],
};

export const MATRIX_ROW_TO_CATEGORIES: Record<string, string[]> = {
  Injection: ["DPI", "JBK"],
  "Tool Abuse": ["PEX"],
  Exfiltration: ["DEX", "SPE"],
  "Goal Drift": ["MSE"],
};

export type Intensity = "Low" | "Med" | "High";

export function categoriesFromAttackSets(sets: string[]): string[] {
  const out = new Set<string>();
  for (const s of sets) {
    for (const code of ATTACK_SET_TO_CATEGORIES[s] ?? []) out.add(code);
  }
  return [...out];
}

/** Union categories from checked matrix cells. */
export function categoriesFromMatrix(
  matrix: Record<string, Record<string, boolean>>
): string[] {
  const out = new Set<string>();
  for (const [row, cols] of Object.entries(matrix)) {
    const anyOn = Object.values(cols).some(Boolean);
    if (!anyOn) continue;
    for (const code of MATRIX_ROW_TO_CATEGORIES[row] ?? []) out.add(code);
  }
  return [...out];
}

/** Highest intensity among checked matrix cells. */
export function intensityFromMatrix(
  matrix: Record<string, Record<string, boolean>>
): Intensity {
  let high = false;
  let med = false;
  for (const cols of Object.values(matrix)) {
    if (cols.High) high = true;
    if (cols.Med) med = true;
  }
  if (high) return "High";
  if (med) return "Med";
  return "Low";
}

export function mergeCampaignCategories(
  sets: string[],
  matrix: Record<string, Record<string, boolean>>
): string[] {
  const out = new Set<string>([
    ...categoriesFromAttackSets(sets),
    ...categoriesFromMatrix(matrix),
  ]);
  return [...out];
}

export function mutationsForIntensity(intensity: Intensity): {
  mutations_enabled: boolean;
  max_mutations_per_attack: number;
} {
  if (intensity === "High") return { mutations_enabled: true, max_mutations_per_attack: 3 };
  if (intensity === "Med") return { mutations_enabled: true, max_mutations_per_attack: 2 };
  return { mutations_enabled: false, max_mutations_per_attack: 0 };
}

/** Lab technique label → category codes. */
export function categoriesFromTechnique(technique: string): string[] {
  return ATTACK_SET_TO_CATEGORIES[technique] ?? ["DPI", "JBK"];
}
