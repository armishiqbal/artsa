/**
 * Attack Library helpers — template variable expansion and deep-links.
 */

export type AttackTemplateMeta = {
  severity?: string;
  mitre_atlas?: string;
  owasp_llm?: string;
  tags?: string[];
  success_rate?: number;
  mutations_available?: string[];
  description?: string;
};

export type AttackTemplateLike = {
  id?: unknown;
  name?: unknown;
  category?: unknown;
  description?: unknown;
  template?: unknown;
  variables?: unknown;
  metadata?: unknown;
  source?: unknown;
  version?: unknown;
};

/** Replace `{{key}}` placeholders with values from variables (case-sensitive keys). */
export function expandTemplateVariables(
  template: string,
  variables?: Record<string, string> | null
): string {
  if (!template) return "";
  if (!variables || Object.keys(variables).length === 0) return template;
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = variables[key];
    return value != null && value !== "" ? value : match;
  });
}

export function templateVariables(t: AttackTemplateLike): Record<string, string> {
  const raw = t.variables;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v != null && typeof v !== "object") out[k] = String(v);
  }
  return out;
}

export function templateMetadata(t: AttackTemplateLike): AttackTemplateMeta {
  const raw = t.metadata;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const m = raw as Record<string, unknown>;
  const tags = Array.isArray(m.tags) ? m.tags.map(String) : undefined;
  const mutations = Array.isArray(m.mutations_available)
    ? m.mutations_available.map(String)
    : undefined;
  return {
    severity: m.severity != null ? String(m.severity) : undefined,
    mitre_atlas: m.mitre_atlas != null ? String(m.mitre_atlas) : undefined,
    owasp_llm: m.owasp_llm != null ? String(m.owasp_llm) : undefined,
    tags,
    success_rate: typeof m.success_rate === "number" ? m.success_rate : undefined,
    mutations_available: mutations,
    description: m.description != null ? String(m.description) : undefined,
  };
}

export function expandedProbe(t: AttackTemplateLike): string {
  return expandTemplateVariables(String(t.template ?? ""), templateVariables(t));
}

export function sandboxHrefForTemplate(t: AttackTemplateLike): string {
  const id = String(t.id ?? "").trim();
  if (id) return `/sandbox?template=${encodeURIComponent(id)}`;
  const user = expandedProbe(t);
  return `/sandbox?user=${encodeURIComponent(user.slice(0, 1800))}`;
}

export function campaignHrefForTemplate(t: AttackTemplateLike): string {
  const cat = String(t.category ?? "").trim();
  const params = new URLSearchParams({ new: "1" });
  if (cat) params.set("category", cat);
  return `/campaigns?${params.toString()}`;
}
