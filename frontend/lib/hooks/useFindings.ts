"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchFromBackend } from "@/lib/api";

export interface ServerFinding {
  id: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  asi_code: string | null;
  asi_label: string | null;
  status: string;
  source: string;
  source_ref?: string;
  timestamp: string | null;
  verdict?: string;
  attack_prompt?: string;
  reasoning?: string;
  custody_chain?: Array<{
    agent: string;
    label: string;
    action: string;
    hmac_verified: boolean | null;
  }>;
  playbook_version?: number | null;
  promoted_rule_name?: string | null;
}

export function useFindings() {
  const [findings, setFindings] = useState<ServerFinding[]>([]);
  const [playbookVersion, setPlaybookVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await fetchFromBackend<{
      findings?: ServerFinding[];
      playbook_version?: number;
    }>("/api/v1/findings", { silent: true });
    if (data?.findings) setFindings(data.findings);
    setPlaybookVersion(data?.playbook_version ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getFinding = useCallback(
    async (id: string): Promise<ServerFinding | null> => {
      const cached = findings.find((f) => f.id === id);
      if (cached?.custody_chain?.length) return cached;
      return fetchFromBackend<ServerFinding>(`/api/v1/findings/${encodeURIComponent(id)}`, {
        silent: true,
      });
    },
    [findings]
  );

  return { findings, playbookVersion, loading, refresh, getFinding };
}
