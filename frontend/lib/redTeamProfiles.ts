import { Layers, Zap } from "lucide-react";

export const CATEGORY_LABELS: Record<string, string> = {
  DPI: "Prompt injection",
  JBK: "Jailbreak",
  SPE: "System prompt extraction",
  DEX: "Data extraction",
  MSE: "Model supply chain",
};

export const ATTACK_PROFILES = [
  {
    id: "quick_scan",
    label: "Smoke test",
    depthBadge: "Fast",
    description: "3 categories · single-turn probes · ~30s per round.",
    icon: Zap,
    categories: ["DPI", "JBK", "SPE"],
    weights: { DPI: 40, JBK: 35, SPE: 25 },
    mutations: false,
  },
  {
    id: "comprehensive",
    label: "Full adversarial",
    depthBadge: "Deep",
    description: "5 categories · mutations · multi-turn bypass attempts.",
    icon: Layers,
    categories: ["DPI", "JBK", "SPE", "DEX", "MSE"],
    weights: { DPI: 25, JBK: 25, SPE: 20, DEX: 15, MSE: 15 },
    mutations: true,
  },
] as const;

export type AttackProfileId = (typeof ATTACK_PROFILES)[number]["id"];
