import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useThreatResearch } from "@/lib/hooks/useThreatResearch";
import { fetchFromBackend } from "@/lib/api";

// Mock @/lib/api
vi.mock("@/lib/api", () => ({
  fetchFromBackend: vi.fn(),
}));

// Mock @/lib/stores/toast
vi.mock("@/lib/stores/toast", () => ({
  toast: vi.fn(),
}));

describe("useThreatResearch Hook & Research APIs", () => {
  const mockThreats = [
    {
      id: "t-1",
      source: "OWASP_ASI",
      framework_id: "ASI01",
      title: "Goal Hijack & Instruction Override",
      description: "Direct steering of agent objectives",
      category: "PROMPT_INJECTION",
      severity: "CRITICAL",
      technical_details: "System prompt override pattern",
      prerequisites: [],
      suggested_vectors: ["Override system directives {{target_objective}}"],
      tags: ["owasp_asi", "critical"],
      timestamp: "2026-09-29T10:00:00Z",
    },
    {
      id: "t-2",
      source: "MITRE_ATLAS",
      framework_id: "AML.T0051",
      title: "LLM Prompt Injection",
      description: "Adversarial steering",
      category: "PROMPT_INJECTION",
      severity: "HIGH",
      technical_details: "Direct delimiter manipulation",
      prerequisites: ["tool:bash"],
      suggested_vectors: ["Execute bash script {{instruction}}"],
      tags: ["mitre_atlas"],
      timestamp: "2026-09-29T10:00:00Z",
    },
  ];

  const mockMetrics = {
    total_threats: 2,
    sources: { OWASP_ASI: 1, MITRE_ATLAS: 1 },
    categories: { PROMPT_INJECTION: 2 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches threat list and framework metrics on mount", async () => {
    vi.mocked(fetchFromBackend).mockImplementation(async (path: string) => {
      if (path.includes("/frameworks")) return mockMetrics;
      if (path.includes("/threats")) return { count: 2, threats: mockThreats };
      return null;
    });

    const { result } = renderHook(() => useThreatResearch({ autoFetch: true }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.metrics).toEqual(mockMetrics);
    expect(result.current.threats).toEqual(mockThreats);
    expect(result.current.loading).toBe(false);
  });

  it("calls POST /api/v1/research/sync on syncLiveFeeds", async () => {
    const syncResponse = {
      status: "success",
      nvd_count: 3,
      mitre_atlas_count: 5,
      total_ingested: 8,
    };

    vi.mocked(fetchFromBackend).mockImplementation(async (path: string) => {
      if (path === "/api/v1/research/sync") return syncResponse;
      if (path.includes("/threats")) return { count: 2, threats: mockThreats };
      if (path.includes("/frameworks")) return mockMetrics;
      return null;
    });

    const { result } = renderHook(() => useThreatResearch({ autoFetch: false }));

    let res;
    await act(async () => {
      res = await result.current.syncLiveFeeds("agent prompt injection", 5);
    });

    expect(res).toEqual(syncResponse);
    expect(fetchFromBackend).toHaveBeenCalledWith(
      "/api/v1/research/sync",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ query: "agent prompt injection", limit: 5 }),
      })
    );
  });

  it("simulates capability filtering via POST /api/v1/research/curate/preview", async () => {
    const curateResponse = {
      total_considered: 2,
      retained_count: 1,
      discarded_count: 1,
      retained: [
        {
          record: mockThreats[0],
          preview_seeds: [
            {
              id: "seed-1",
              name: "Curated: Goal Hijack",
              category: "PROMPT_INJECTION",
              template: "Override {{instruction}}",
            },
          ],
        },
      ],
      discarded: [
        {
          record: mockThreats[1],
          rationale: "Target attack surface has no bash/exec tool — vector discarded",
        },
      ],
      surface: {
        tools: ["web_search"],
        has_database: false,
        has_bash: false,
        has_filesystem: false,
        has_rag: false,
        has_admin_tools: false,
      },
    };

    vi.mocked(fetchFromBackend).mockResolvedValueOnce(curateResponse);

    const { result } = renderHook(() => useThreatResearch({ autoFetch: false }));

    let res;
    await act(async () => {
      res = await result.current.simulateCurator({
        tools: ["web_search"],
        has_database: false,
        has_bash: false,
        has_filesystem: false,
        has_rag: false,
        has_admin_tools: false,
      });
    });

    expect(res).toEqual(curateResponse);
    expect(result.current.curateResult).toEqual(curateResponse);
    expect(fetchFromBackend).toHaveBeenCalledWith(
      "/api/v1/research/curate/preview",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("promotes seeds to AttackLibrary via POST /api/v1/research/curate/promote", async () => {
    const promoteResponse = {
      status: "promoted",
      promoted_count: 2,
      template_ids: ["seed_asi01_1", "seed_aml_1"],
      templates: [
        { id: "seed_asi01_1", name: "Curated: Goal Hijack", category: "PROMPT_INJECTION", template: "..." },
        { id: "seed_aml_1", name: "Curated: Prompt Injection", category: "PROMPT_INJECTION", template: "..." },
      ],
    };

    vi.mocked(fetchFromBackend).mockResolvedValueOnce(promoteResponse);

    const { result } = renderHook(() => useThreatResearch({ autoFetch: false }));

    let res;
    await act(async () => {
      res = await result.current.promoteThreats(["ASI01", "AML.T0051"]);
    });

    expect(res).toEqual(promoteResponse);
    expect(fetchFromBackend).toHaveBeenCalledWith(
      "/api/v1/research/curate/promote",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          threat_ids: ["ASI01", "AML.T0051"],
          tools: [],
          has_database: false,
          has_bash: false,
          has_filesystem: false,
          has_rag: false,
          has_admin_tools: false,
        }),
      })
    );
  });
});
