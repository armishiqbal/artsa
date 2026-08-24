import type { ServerFinding } from "@/lib/hooks/useFindings";

export interface FypExportPayload {
  generatedAt: string;
  playbookVersion: number;
  findingsCount: number;
  campaignsCount: number;
  defenseScore: number;
  threatsBlocked: number;
  findings: Array<{
    title: string;
    severity: string;
    asi: string | null;
    status: string;
  }>;
}

export function buildFypMarkdown(payload: FypExportPayload): string {
  const lines = [
    "# ARTSA — Final Year Project Evidence Pack",
    "",
    `Generated: ${payload.generatedAt}`,
    "",
    "## Executive summary",
    `- Playbook version: **v${payload.playbookVersion || 1}**`,
    `- Defense score: **${payload.defenseScore}%**`,
    `- Threats blocked (session): **${payload.threatsBlocked}**`,
    `- Findings tracked: **${payload.findingsCount}**`,
    `- Campaigns run: **${payload.campaignsCount}**`,
    "",
    "## Findings sample",
    "",
    "| Finding | Severity | ASI | Status |",
    "| --- | --- | --- | --- |",
  ];
  for (const row of payload.findings.slice(0, 15)) {
    lines.push(`| ${row.title} | ${row.severity} | ${row.asi ?? "—"} | ${row.status} |`);
  }
  lines.push("", "## Architecture highlights", "", "- Multi-agent pipeline (Research → Defender)", "- Server-backed findings lifecycle + playbook versioning", "- Chain-of-custody with HMAC verification on judge hops", "- Red Team Console with LLM judge + promote-to-playbook loop", "");
  return lines.join("\n");
}

export function downloadTextFile(filename: string, content: string, mime = "text/markdown") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function findingsToExportRows(findings: ServerFinding[]) {
  return findings.map((f) => ({
    title: f.title,
    severity: f.severity,
    asi: f.asi_code,
    status: f.status,
  }));
}
