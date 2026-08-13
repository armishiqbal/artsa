"""Rich CLI Reporter — beautiful terminal output for campaign results."""

from __future__ import annotations

from typing import Any, ClassVar

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from src.models import CampaignSummary, RoundResult, Severity, Verdict

console = Console()


class CLIReporter:
    """Produces rich, colorful terminal output for wargame campaigns."""

    # ─── Verdict colors ──────────────────────────────────────────────
    VERDICT_STYLE: ClassVar[dict[Verdict, tuple[str, str]]] = {
        Verdict.SUCCESS: ("green", "🟢"),
        Verdict.PARTIAL: ("yellow", "🟡"),
        Verdict.BLOCKED: ("red", "🔴"),
    }

    SEVERITY_STYLE: ClassVar[dict[Severity, str]] = {
        Severity.LOW: "dim",
        Severity.MEDIUM: "cyan",
        Severity.HIGH: "yellow",
        Severity.CRITICAL: "bold red",
    }

    def print_round_result(self, round_result: RoundResult) -> None:
        """Print a single round result as a compact line."""
        verdict = round_result.score.verdict
        color, icon = self.VERDICT_STYLE.get(verdict, ("white", "⚪"))
        is_evolved = round_result.attack.metadata.get("evolved", False)
        is_rewrite = "llm_rewrite" in round_result.attack.mutations_applied
        is_multi = round_result.attack.metadata.get("is_multi_turn", False)

        tags = []
        if is_evolved:
            tags.append("🧬")
        if is_rewrite:
            tags.append("✍️")
        if is_multi:
            turns = round_result.attack.metadata.get("chain_turns", "?")
            tags.append(f"🔗{turns}t")

        tag_str = " ".join(tags) if tags else ""

        console.print(
            f"  R{round_result.round_number:>3} │ "
            f"[dim]{round_result.attack.category.value}[/dim] │ "
            f"{icon} [{color}]{verdict.value:>7}[/{color}] │ "
            f"Score: [{color}]{round_result.score.attack_success_score:>2}/10[/{color}] │ "
            f"Bypass: {round_result.score.bypass_depth}/4 │ "
            f"{round_result.attack.name[:35]:<35} "
            f"{tag_str}"
        )

    def print_campaign_summary(self, summary: CampaignSummary) -> None:
        """Print the full campaign summary with tables."""
        console.print()

        # ─── Main summary table ──────────────────────────────────────
        table = Table(
            title="📊 Campaign Results",
            show_header=True,
            header_style="bold magenta",
            border_style="blue",
            padding=(0, 1),
        )
        table.add_column("Metric", style="bold")
        table.add_column("Value", justify="right")

        total = summary.total_rounds
        success = summary.results_by_verdict.get("SUCCESS", 0)
        partial = summary.results_by_verdict.get("PARTIAL", 0)
        blocked = summary.results_by_verdict.get("BLOCKED", 0)

        table.add_row("Total Rounds", str(total))
        table.add_row(
            "Successful Attacks",
            f"[green]{success}[/green] ({self._pct(success, total)})",
        )
        table.add_row(
            "Partial Successes",
            f"[yellow]{partial}[/yellow] ({self._pct(partial, total)})",
        )
        table.add_row(
            "Blocked Attacks",
            f"[red]{blocked}[/red] ({self._pct(blocked, total)})",
        )
        table.add_row("", "")
        table.add_row(
            "Avg Attack Score",
            f"[{'green' if summary.avg_attack_success >= 5 else 'red'}]{summary.avg_attack_success:.1f}/10[/]",
        )
        table.add_row(
            "Avg Defense Score",
            f"[{'green' if summary.avg_defense_quality >= 7 else 'yellow'}]{summary.avg_defense_quality:.1f}/10[/]",
        )
        table.add_row(
            "Avg Bypass Depth",
            f"{summary.avg_bypass_depth:.1f}/4",
        )

        if summary.total_duration_ms > 0:
            secs = summary.total_duration_ms / 1000
            table.add_row("Duration", f"{secs:.1f}s")

        console.print(table)

    def print_category_breakdown(self, summary: CampaignSummary) -> None:
        """Print per-category stats table."""
        if not summary.results_by_category:
            return

        console.print()
        table = Table(
            title="📋 Category Breakdown",
            show_header=True,
            header_style="bold cyan",
            border_style="cyan",
        )
        table.add_column("Category", width=8)
        table.add_column("Attempts", justify="right", width=9)
        table.add_column("Success", justify="right", width=8)
        table.add_column("Partial", justify="right", width=8)
        table.add_column("Blocked", justify="right", width=8)
        table.add_column("Avg Score", justify="right", width=10)

        for cat, data in sorted(summary.results_by_category.items()):
            attempts = data.get("attempts", 0)
            s = data.get("success", 0)
            p = data.get("partial", 0)
            b = data.get("blocked", 0)
            avg = data.get("avg_score", 0.0)

            score_color = "green" if avg >= 5 else ("yellow" if avg >= 2 else "red")
            table.add_row(
                cat,
                str(attempts),
                f"[green]{s}[/green]",
                f"[yellow]{p}[/yellow]",
                f"[red]{b}[/red]",
                f"[{score_color}]{avg:.1f}/10[/{score_color}]",
            )

        console.print(table)

    def print_top_findings(
        self,
        summary: CampaignSummary,
        max_findings: int = 5,
    ) -> None:
        """Print the top N most impactful findings."""
        findings = summary.top_findings[:max_findings]
        if not findings:
            return

        console.print()
        console.print("[bold red]🔥 Top Findings[/bold red]")

        for i, finding in enumerate(findings, 1):
            sev = finding.score.severity
            sev_style = self.SEVERITY_STYLE.get(sev, "white")
            verdict_color, _verdict_icon = self.VERDICT_STYLE.get(
                finding.score.verdict, ("white", "⚪")
            )

            panel_content = (
                f"[bold]Category:[/bold] {finding.attack.category.value}\n"
                f"[bold]Verdict:[/bold] [{verdict_color}]{finding.score.verdict.value}[/{verdict_color}] "
                f"| Score: {finding.score.attack_success_score}/10\n"
                f"[bold]Severity:[/bold] [{sev_style}]{sev.value}[/{sev_style}]\n"
                f"[bold]Bypass Depth:[/bold] {finding.score.bypass_depth}/4\n"
            )

            if finding.score.reasoning:
                panel_content += f"\n[bold]Reasoning:[/bold]\n{finding.score.reasoning[:200]}"

            console.print(
                Panel(
                    panel_content,
                    title=f"#{i} {finding.attack.name[:50]}",
                    border_style=sev_style,
                    width=80,
                )
            )

    def print_evolution_summary(self, evo_summary: dict[str, Any]) -> None:
        """Print evolution engine stats."""
        if evo_summary.get("current_generation", 0) == 0:
            return

        console.print()
        table = Table(
            title="🧬 Evolution Summary",
            show_header=True,
            header_style="bold yellow",
            border_style="yellow",
        )
        table.add_column("Generation", justify="center")
        table.add_column("Population", justify="right")
        table.add_column("Avg Fitness", justify="right")
        table.add_column("Best Fitness", justify="right")

        for gen_stat in evo_summary.get("generation_stats", []):
            table.add_row(
                str(gen_stat["generation"]),
                str(gen_stat["population_size"]),
                f"{gen_stat['avg_fitness']:.2f}",
                f"{gen_stat['best_fitness']:.1f}/10",
            )

        console.print(table)
        console.print(
            f"  All-time best: [bold green]{evo_summary.get('all_time_best_attack', 'N/A')}[/bold green] "
            f"(fitness: {evo_summary.get('all_time_best_fitness', 0)}/10)"
        )

    # ─── Helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _pct(part: int, total: int) -> str:
        if total == 0:
            return "0%"
        return f"{part / total * 100:.0f}%"
