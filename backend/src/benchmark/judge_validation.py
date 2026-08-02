"""Judge validation — compare LLM judge vs human labels and track variance."""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from typing import Any, Dict, List

from src.agents.judge_agent import JudgeAgent
from src.models import AttackPayload, AttackCategory, JudgeScore, TargetResponse, Verdict


@dataclass
class JudgeValidationResult:
    total_samples: int
    agreement_rate: float
    avg_score_delta: float
    inter_run_variance: float
    mismatches: List[Dict[str, Any]] = field(default_factory=list)


class JudgeValidator:
    """Validates JudgeAgent output against human-labeled ground truth."""

    def __init__(self, judge_config: dict[str, Any] | None = None) -> None:
        self.judge = JudgeAgent(config=judge_config or {"use_llm": False})

    def validate(
        self,
        labeled_samples: List[Dict[str, Any]],
        runs_per_sample: int = 2,
    ) -> JudgeValidationResult:
        agreements = 0
        score_deltas: list[float] = []
        run_scores: list[list[int]] = []
        mismatches: list[dict] = []

        for sample in labeled_samples:
            attack = AttackPayload(
                category=AttackCategory(sample.get("category", "DPI")),
                name=sample.get("name", "validation-attack"),
                prompt=sample["prompt"],
                objective=sample.get("objective", "test"),
            )
            response = TargetResponse(response=sample.get("response", ""))
            human_verdict = Verdict(sample["human_verdict"])

            sample_runs: list[int] = []
            for _ in range(runs_per_sample):
                score: JudgeScore = self.judge._evaluate_heuristic(attack, response)
                sample_runs.append(score.attack_success_score)

                if score.verdict == human_verdict:
                    agreements += 1
                else:
                    mismatches.append(
                        {
                            "name": sample.get("name"),
                            "human_verdict": human_verdict.value,
                            "judge_verdict": score.verdict.value,
                            "judge_score": score.attack_success_score,
                        }
                    )

            if human_verdict == Verdict.SUCCESS:
                human_score = 8
            elif human_verdict == Verdict.PARTIAL:
                human_score = 5
            else:
                human_score = 0
            score_deltas.append(abs(statistics.mean(sample_runs) - human_score))
            if len(sample_runs) > 1:
                run_scores.append(sample_runs)

        total_evals = len(labeled_samples) * runs_per_sample
        variances = [
            statistics.variance(runs) for runs in run_scores if len(runs) > 1
        ]

        return JudgeValidationResult(
            total_samples=len(labeled_samples),
            agreement_rate=round(agreements / total_evals if total_evals else 0.0, 4),
            avg_score_delta=round(statistics.mean(score_deltas) if score_deltas else 0.0, 3),
            inter_run_variance=round(statistics.mean(variances) if variances else 0.0, 4),
            mismatches=mismatches[:10],
        )
