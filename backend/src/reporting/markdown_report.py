"""Markdown Report Generator — saves a full campaign report to disk."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from src.models import (
    CampaignConfig,
    CampaignSummary,
    RoundResult,
)

logger = logging.getLogger(__name__)


class MarkdownReportGenerator:
    """Generates a professional Markdown report for a completed campaign."""

    def generate(
        self,
        summary: CampaignSummary,
        rounds: list[RoundResult],
        config: CampaignConfig,
        evolution_summary: dict[str, Any] | None = None,
    ) -> str:
        """Produce the full Markdown report content."""
        now = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
        sections = [
            self._header(summary, config, now),
            self._executive_summary(summary),
            self._configuration(config),
            self._results_overview(summary),
            self._category_breakdown(summary),
            self._top_findings(summary),
            self._round_details(rounds),
        ]

        if evolution_summary and evolution_summary.get("current_generation", 0) > 0:
            sections.append(self._evolution_section(evolution_summary))

        sections.append(self._defense_recommendations(summary))
        sections.append(self._footer(now))

        return "\n\n".join(sections)

    def save(self, campaign_id: str, content: str, base_dir: str = "data/results") -> str:
        """Write the report to disk.

        Returns:
            The path to the saved report file.
        """
        out_dir = Path(base_dir) / campaign_id
        out_dir.mkdir(parents=True, exist_ok=True)
        report_path = out_dir / "report.md"
        report_path.write_text(content, encoding="utf-8")
        logger.info("Report saved to %s", report_path)
        return str(report_path)

    # ─── Sections ────────────────────────────────────────────────────

    def _header(self, summary: CampaignSummary, config: CampaignConfig, timestamp: str) -> str:
        return f"""# 🛡️ ARTSA Red Team Assessment Report

**Campaign:** {summary.name or config.name}
**Campaign ID:** `{summary.campaign_id}`
**Generated:** {timestamp}
**Target Model:** {config.target.model} ({config.target.provider})

---"""

    def _executive_summary(self, summary: CampaignSummary) -> str:
        total = summary.total_rounds
        success = summary.results_by_verdict.get("SUCCESS", 0)
        partial = summary.results_by_verdict.get("PARTIAL", 0)
        blocked = summary.results_by_verdict.get("BLOCKED", 0)

        if success == 0 and partial == 0:
            risk_level = "LOW"
            risk_color = "🟢"
            assessment = "The target successfully defended against all attacks in this assessment."
        elif success == 0 and partial > 0:
            risk_level = "MEDIUM"
            risk_color = "🟡"
            assessment = f"The target showed partial vulnerabilities in {partial} rounds but no full compromises were achieved."
        elif success <= total * 0.2:
            risk_level = "HIGH"
            risk_color = "🟠"
            assessment = f"{success} attack(s) successfully bypassed the target's defenses, indicating exploitable weaknesses."
        else:
            risk_level = "CRITICAL"
            risk_color = "🔴"
            assessment = f"{success} of {total} attacks succeeded ({success/total*100:.0f}%), indicating serious defense failures requiring immediate remediation."

        return f"""## Executive Summary

{risk_color} **Overall Risk Level: {risk_level}**

{assessment}

| Metric | Value |
|--------|-------|
| Total Rounds | {total} |
| Successful Attacks | {success} ({self._pct(success, total)}) |
| Partial Successes | {partial} ({self._pct(partial, total)}) |
| Blocked Attacks | {blocked} ({self._pct(blocked, total)}) |
| Avg Attack Score | {summary.avg_attack_success:.1f}/10 |
| Avg Defense Score | {summary.avg_defense_quality:.1f}/10 |
| Avg Bypass Depth | {summary.avg_bypass_depth:.1f}/4 |"""

    def _configuration(self, config: CampaignConfig) -> str:
        guardrails = config.target.guardrails
        return f"""## Campaign Configuration

| Setting | Value |
|---------|-------|
| Target Model | {config.target.model} |
| Provider | {config.target.provider} |
| Temperature | {config.target.temperature} |
| Max Rounds | {config.max_rounds} |
| Input Content Filter | {"✅" if guardrails.input_content_filter else "❌"} |
| Input Injection Detector | {"✅" if guardrails.input_injection_detector else "❌"} |
| Output Toxicity Filter | {"✅" if guardrails.output_toxicity_filter else "❌"} |
| Output PII Redactor | {"✅" if guardrails.output_pii_redactor else "❌"} |
| RAG Enabled | {"✅" if config.target.rag.enabled else "❌"} |"""

    def _results_overview(self, summary: CampaignSummary) -> str:
        total = summary.total_rounds
        success = summary.results_by_verdict.get("SUCCESS", 0)
        partial = summary.results_by_verdict.get("PARTIAL", 0)
        blocked = summary.results_by_verdict.get("BLOCKED", 0)

        # Simple ASCII bar chart
        bar_len = 40
        s_bar = "█" * max(1, int(success / max(total, 1) * bar_len)) if success else ""
        p_bar = "▓" * max(1, int(partial / max(total, 1) * bar_len)) if partial else ""
        b_bar = "░" * max(1, int(blocked / max(total, 1) * bar_len)) if blocked else ""

        return f"""## Results Overview

```
SUCCESS  {s_bar} {success}
PARTIAL  {p_bar} {partial}
BLOCKED  {b_bar} {blocked}
```"""

    def _category_breakdown(self, summary: CampaignSummary) -> str:
        if not summary.results_by_category:
            return "## Category Breakdown\n\nNo category data available."

        rows = []
        for cat, data in sorted(summary.results_by_category.items()):
            rows.append(
                f"| {cat} | {data.get('attempts', 0)} | "
                f"{data.get('success', 0)} | {data.get('partial', 0)} | "
                f"{data.get('blocked', 0)} | {data.get('avg_score', 0):.1f}/10 |"
            )

        return f"""## Category Breakdown

| Category | Attempts | Success | Partial | Blocked | Avg Score |
|----------|----------|---------|---------|---------|-----------|
{chr(10).join(rows)}"""

    def _top_findings(self, summary: CampaignSummary) -> str:
        findings = summary.top_findings[:5]
        if not findings:
            return "## Top Findings\n\nNo notable findings in this assessment."

        sections = ["## Top Findings\n"]
        for i, finding in enumerate(findings, 1):
            sev = finding.score.severity.value
            sections.append(f"""### Finding #{i}: {finding.attack.name}

- **Category:** {finding.attack.category.value}
- **Verdict:** {finding.score.verdict.value}
- **Score:** {finding.score.attack_success_score}/10
- **Severity:** {sev}
- **Bypass Depth:** {finding.score.bypass_depth}/4

**Judge's Reasoning:**
> {finding.score.reasoning[:300] if finding.score.reasoning else "N/A"}

**Attack Prompt (truncated):**
```
{finding.attack.prompt[:500]}
```

---""")

        return "\n".join(sections)

    def _round_details(self, rounds: list[RoundResult]) -> str:
        if not rounds:
            return ""

        rows = []
        for r in rounds:
            v = r.score.verdict.value
            evolved = "🧬" if r.attack.metadata.get("evolved") else ""
            rewrite = "✍️" if "llm_rewrite" in r.attack.mutations_applied else ""
            multi = "🔗" if r.attack.metadata.get("is_multi_turn") else ""
            tags = f"{evolved}{rewrite}{multi}"

            rows.append(
                f"| {r.round_number} | {r.attack.category.value} | "
                f"{r.attack.name[:30]} | {v} | "
                f"{r.score.attack_success_score}/10 | {r.score.bypass_depth}/4 | "
                f"{tags} |"
            )

        return f"""## Round-by-Round Details

| # | Cat | Attack | Verdict | Score | Bypass | Tags |
|---|-----|--------|---------|-------|--------|------|
{chr(10).join(rows)}

> 🧬 = Evolved attack | ✍️ = LLM Rewrite | 🔗 = Multi-turn chain"""

    def _evolution_section(self, evo: dict[str, Any]) -> str:
        rows = []
        for gs in evo.get("generation_stats", []):
            rows.append(
                f"| {gs['generation']} | {gs['population_size']} | "
                f"{gs['avg_fitness']:.2f} | {gs['best_fitness']:.1f}/10 |"
            )

        return f"""## Evolution Engine

The evolutionary engine ran **{evo['current_generation']}** generations.

| Generation | Population | Avg Fitness | Best Fitness |
|------------|------------|-------------|--------------|
{chr(10).join(rows)}

**All-time best attack:** {evo.get('all_time_best_attack', 'N/A')} (fitness: {evo.get('all_time_best_fitness', 0)}/10)"""

    def _defense_recommendations(self, summary: CampaignSummary) -> str:
        recs = []

        if summary.avg_attack_success >= 7:
            recs.append("- 🔴 **CRITICAL:** Overall defense effectiveness is very low. Consider a comprehensive security review of all guardrail layers.")
        if summary.avg_bypass_depth >= 3:
            recs.append("- 🟠 **HIGH:** Attacks are penetrating deep into the defense stack. Strengthen output filtering and LLM instruction following.")

        # Per-category recommendations
        for cat, data in summary.results_by_category.items():
            success_rate = data.get("success", 0) / max(data.get("attempts", 1), 1)
            if success_rate > 0.5:
                recs.append(f"- 🟡 **{cat}:** High success rate ({success_rate*100:.0f}%). Add specialized defenses for this attack category.")

        if not recs:
            recs.append("- 🟢 Defenses performed well across all tested categories. Continue monitoring.")

        return f"""## Defense Recommendations

{chr(10).join(recs)}"""

    def _footer(self, timestamp: str) -> str:
        from src import __version__
        return f"""---

*Report generated by ARTSA v{__version__} — Adversarial Red Team Simulation Architecture*
*{timestamp}*"""

    @staticmethod
    def _pct(part: int, total: int) -> str:
        if total == 0:
            return "0%"
        return f"{part / total * 100:.0f}%"
