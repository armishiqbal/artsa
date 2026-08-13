"""Detector ablation study — measure contribution of each detector."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from src.benchmark.harness import BenchmarkHarness
from src.containment.engine import ContainmentEngine
from src.core.models.events import ToolCallEvent


@dataclass
class AblationResult:
    detector: str
    disabled: bool
    recall_at_80: float
    precision_at_80: float
    fpr_at_50: float
    avg_latency_ms: float
    recall_delta: float = 0.0


@dataclass
class AblationReport:
    baseline_recall: float
    baseline_precision: float
    results: list[AblationResult] = field(default_factory=list)
    dataset_version: str = ""


class AblationHarness(BenchmarkHarness):
    """Run benchmark with each detector disabled to measure marginal contribution."""

    def run_ablation(self, threshold: float = 80.0) -> AblationReport:

        samples = self.load_dataset()
        baseline = self._run_engine(ContainmentEngine(), samples)
        baseline_metrics = self._metrics_at_threshold(baseline, threshold)
        self._metrics_at_threshold(baseline, 50.0)

        results: list[AblationResult] = []
        for detector_name in ContainmentEngine.DETECTOR_NAMES:
            engine = ContainmentEngine(disabled_detectors=[detector_name])
            scores = self._run_engine(engine, samples)
            m80 = self._metrics_at_threshold(scores, threshold)
            m50 = self._metrics_at_threshold(scores, 50.0)
            avg_latency = sum(s[2] for s in scores) / len(scores) if scores else 0.0

            results.append(
                AblationResult(
                    detector=detector_name,
                    disabled=True,
                    recall_at_80=m80.recall,
                    precision_at_80=m80.precision,
                    fpr_at_50=m50.fpr,
                    avg_latency_ms=round(avg_latency, 3),
                    recall_delta=round(m80.recall - baseline_metrics.recall, 4),
                )
            )

        return AblationReport(
            baseline_recall=baseline_metrics.recall,
            baseline_precision=baseline_metrics.precision,
            results=results,
            dataset_version=self.dataset_version,
        )

    def _run_engine(
        self, engine: ContainmentEngine, samples: list[dict[str, Any]]
    ) -> list[tuple[float, bool, float]]:
        import time

        scores: list[tuple[float, bool, float]] = []
        for sample in samples:
            event = ToolCallEvent(
                session_id=uuid.uuid4(),
                agent_id=sample.get("agent_id", "benchmark-agent"),
                tool_name=sample["tool_name"],
                arguments=sample.get("arguments", {}),
            )
            start = time.perf_counter()
            risk_score, _, _ = engine.evaluate_event(event)
            latency_ms = (time.perf_counter() - start) * 1000
            scores.append((risk_score.overall_score, sample["label"] == "malicious", latency_ms))
        return scores

    def to_ablation_dict(self, report: AblationReport) -> dict[str, Any]:
        return {
            "dataset_version": report.dataset_version,
            "baseline": {
                "recall_at_80": report.baseline_recall,
                "precision_at_80": report.baseline_precision,
            },
            "ablation": [
                {
                    "detector": r.detector,
                    "recall_at_80": r.recall_at_80,
                    "precision_at_80": r.precision_at_80,
                    "fpr_at_50": r.fpr_at_50,
                    "avg_latency_ms": r.avg_latency_ms,
                    "recall_delta_vs_baseline": r.recall_delta,
                }
                for r in report.results
            ],
        }
