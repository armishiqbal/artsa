"""Campaign Manager — Orchestrates the Red Team, Target, and Judge."""

from __future__ import annotations

import logging
import time
from typing import Any

from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn
from rich.console import Console

from src.reporting.cli_reporter import CLIReporter
from src.reporting.markdown_report import MarkdownReportGenerator

from src.agents import JudgeAgent, RedTeamAgent, TargetAgent
from src.attacks.chain import AttackChain
from src.attacks.social_engineering import SocialEngineeringAttack
from src.data import AttackLibrary, ResultsStore, VectorStoreManager
from src.models import (
    AttackCategory,
    AttackPayload,
    CampaignConfig,
    CampaignSummary,
    RoundResult,
    Verdict,
)
from src.orchestrator.state_machine import CampaignStateMachine

logger = logging.getLogger(__name__)
console = Console()


class CampaignManager:
    """Orchestrates an end-to-end wargame campaign with evolutionary learning."""

    reporter = CLIReporter()
    report_gen = MarkdownReportGenerator()

    def __init__(
        self,
        config: CampaignConfig,
        app_config: dict[str, Any],
    ) -> None:
        self.config = config
        self.app_config = app_config
        self.fsm = CampaignStateMachine()

        # Init Data Layer
        self.vector_store = VectorStoreManager(
            persist_dir=app_config["artsa"]["vector_store"]["persist_directory"]
        )
        from pathlib import Path
        backend_dir = Path(__file__).resolve().parent.parent.parent
        lib_dir = backend_dir / "attack_library"
        self.attack_library = AttackLibrary(library_dir=str(lib_dir), vector_store=self.vector_store)
        self.attack_library.load_from_directory()


        self.results_store = ResultsStore(
            data_dir=app_config["artsa"]["data_dir"] + "/results"
        )

        # Init Agents
        self.target_agent = TargetAgent(config.target)
        self.red_team = RedTeamAgent(
            config=app_config["artsa"]["red_team"],
            attack_profile=config.attack_profile,
            attack_library=self.attack_library,
            target_config=config.target,
        )
        self.judge = JudgeAgent(config=app_config["artsa"]["judge"])

        # State tracking
        self.history_stats: dict[str, dict[str, Any]] = {}
        self.total_cost = 0.0
        self._pending_rewrite: AttackPayload | None = None  # Queued LLM rewrite for next round

    def _update_history_stats(self, round_result: RoundResult) -> None:
        cat = round_result.attack.category.value
        if cat not in self.history_stats:
            self.history_stats[cat] = {
                "attempts": 0,
                "total_score": 0.0,
                "avg_score": 0.0,
            }

        self.history_stats[cat]["attempts"] += 1
        self.history_stats[cat]["total_score"] += round_result.score.attack_success_score
        self.history_stats[cat]["avg_score"] = (
            self.history_stats[cat]["total_score"]
            / self.history_stats[cat]["attempts"]
        )

    def run(self, on_round_complete=None) -> CampaignSummary:
        """Run the campaign with evolutionary attack learning."""
        self.fsm.start()
        self.results_store.save_campaign_config(self.config)

        delay = self.app_config["artsa"]["rate_limit"]["delay_between_rounds_sec"]

        console.print(
            f"\n[bold blue]⚔️  Starting Campaign:[/bold blue] {self.config.name}"
        )
        console.print(
            f"   Target: [cyan]{self.config.target.model}[/cyan] | "
            f"Rounds: [cyan]{self.config.max_rounds}[/cyan] | "
            f"Evolution: [green]ON[/green]\n"
        )

        # Track all round results for reporting
        all_rounds: list[RoundResult] = []

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            console=console,
            transient=True,
        ) as progress:

            task = progress.add_task(
                "[cyan]Running wargame...", total=self.config.max_rounds
            )

            for round_idx in range(1, self.config.max_rounds + 1):
                round_start = time.time()

                # ─── 1. Maybe evolve the population ────────────────
                if round_idx > 1:
                    evolved = self.red_team.maybe_evolve()
                    if evolved:
                        gen = self.red_team.evolution_engine.current_generation
                        progress.update(
                            task,
                            description=f"[yellow]🧬 Evolution cycle! Generation {gen}",
                        )

                # ─── 2. Red Team selects category + generates attack ─
                progress.update(
                    task,
                    description=f"[cyan]Round {round_idx}: Red Team planning...",
                )

                # Use a pending LLM rewrite if one exists
                if self._pending_rewrite is not None:
                    attack_payload = self._pending_rewrite
                    category = attack_payload.category
                    self._pending_rewrite = None
                else:
                    category = self.red_team.select_attack_category(self.history_stats)
                    attack_payload = self.red_team.generate_attack(category)

                # ─── 3. Target processes the attack ──────────────────
                # Check for multi-turn chain (social engineering)
                is_chain = False
                if category == AttackCategory.SOCIAL_ENGINEERING:
                    se_plugin = self.red_team.plugins.get(AttackCategory.SOCIAL_ENGINEERING)
                    if isinstance(se_plugin, SocialEngineeringAttack):
                        # Use the same template the attack_payload was generated from
                        template_id = attack_payload.template_id
                        template = self.red_team.attack_library.get_by_id(template_id)
                        if template and se_plugin.is_multi_turn_template(template):
                            is_chain = True
                            chain = se_plugin.generate_chain(template)
                            progress.update(
                                task,
                                description=f"[cyan]Round {round_idx}: Multi-turn chain ({chain.total_turns} turns)...",
                            )
                            # Execute all turns
                            last_payload = attack_payload
                            last_response = None
                            while not chain.is_complete():
                                last_payload = chain.current_payload()
                                if chain.conversation_history:
                                    last_response = self.target_agent.process_with_history(
                                        last_payload.prompt, chain.conversation_history
                                    )
                                else:
                                    last_response = self.target_agent.process(last_payload.prompt)
                                chain.advance(last_response.response)
                                if last_response.blocked:
                                    break
                            # Use the last turn's payload and response for judging
                            if last_response is not None:
                                attack_payload = last_payload
                                attack_payload.metadata["is_multi_turn"] = True
                                attack_payload.metadata["chain_turns"] = chain.total_turns
                                target_response = last_response
                            else:
                                is_chain = False  # Empty chain, fall through

                if not is_chain:
                    progress.update(
                        task,
                        description=f"[cyan]Round {round_idx}: Target processing...",
                    )
                    target_response = self.target_agent.process(attack_payload.prompt)

                # ─── 4. Judge evaluates ──────────────────────────────
                progress.update(
                    task,
                    description=f"[cyan]Round {round_idx}: Judge evaluating...",
                )
                score = self.judge.evaluate(attack_payload, target_response)

                duration = (time.time() - round_start) * 1000

                # ─── 5. Record result ────────────────────────────────
                result = RoundResult(
                    round_number=round_idx,
                    attack=attack_payload,
                    response=target_response,
                    score=score,
                    duration_ms=duration,
                )

                self.results_store.save_round(self.config.id, result)
                self.vector_store.log_attack_result(
                    attack_id=attack_payload.id,
                    template_id=attack_payload.template_id,
                    success=(score.verdict == Verdict.SUCCESS),
                    score=score.attack_success_score,
                    category=category.value,
                )
                self._update_history_stats(result)

                # ─── 6. Feed into evolution engine ───────────────────
                self.red_team.feed_result(attack_payload, score)

                # ─── 6b. Maybe queue LLM rewrite for next round ──────
                if score.verdict in (Verdict.BLOCKED, Verdict.PARTIAL):
                    rewritten = self.red_team.rewrite_attack_with_llm(
                        attack_payload, score, target_response.response
                    )
                    if rewritten:
                        self._pending_rewrite = rewritten

                # ─── 7. Log per-round result ─────────────────────────
                all_rounds.append(result)
                self.reporter.print_round_result(result)

                progress.advance(task)
                if on_round_complete:
                    on_round_complete(round_idx, self.config.max_rounds)

                if round_idx < self.config.max_rounds:
                    time.sleep(delay)

        self.fsm.complete()

        # Generate summary
        summary = self.results_store.generate_summary(self.config.id, self.config)
        self.fsm.report()

        # ─── Print rich CLI reports ──────────────────────────────────
        evo_summary = self.red_team.evolution_engine.get_evolution_summary()
        self.reporter.print_campaign_summary(summary)
        self.reporter.print_category_breakdown(summary)
        self.reporter.print_evolution_summary(evo_summary)
        self.reporter.print_top_findings(summary)

        # ─── Save Markdown report ────────────────────────────────────
        try:
            report_content = self.report_gen.generate(
                summary=summary,
                rounds=all_rounds,
                config=self.config,
                evolution_summary=evo_summary,
            )
            report_path = self.report_gen.save(
                campaign_id=self.config.id,
                content=report_content,
                base_dir=self.app_config["artsa"]["data_dir"] + "/results",
            )
            console.print(
                f"\n[bold green]📄 Report saved:[/bold green] [cyan]{report_path}[/cyan]"
            )
        except Exception as e:
            logger.warning("Failed to generate Markdown report: %s", e)

        return summary
