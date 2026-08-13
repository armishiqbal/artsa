"""Benchmark harness for labeled containment evaluation."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from src.containment.engine import ContainmentEngine
from src.core.models.events import ToolCallEvent


@dataclass
class ThresholdMetrics:
    threshold: float
    precision: float
    recall: float
    fpr: float
    tp: int
    fp: int
    tn: int
    fn: int


@dataclass
class BenchmarkReport:
    total_samples: int
    thresholds: list[ThresholdMetrics] = field(default_factory=list)
    avg_latency_ms: float = 0.0


class BenchmarkHarness:
    """Evaluates ContainmentEngine against a labeled dataset with precision/recall/FPR."""

    def __init__(self, dataset_path: str | Path | None = None) -> None:
        if dataset_path is None:
            backend_dir = Path(__file__).resolve().parent.parent.parent
            v3 = backend_dir / "benchmarks" / "labeled_dataset_v3.json"
            v2 = backend_dir / "benchmarks" / "labeled_dataset.json"
            dataset_path = v3 if v3.exists() else v2
        self.dataset_path = Path(dataset_path)
        self.dataset_version = self.dataset_path.name.replace(".json", "")
        self.engine = ContainmentEngine()

    def load_dataset(self) -> list[dict[str, Any]]:
        with self.dataset_path.open(encoding="utf-8") as f:
            return json.load(f)

    def run(self) -> BenchmarkReport:
        import time
        import uuid

        samples = self.load_dataset()
        scores: list[tuple[float, bool, float]] = []

        for sample in samples:
            event = ToolCallEvent(
                session_id=uuid.uuid4(),
                agent_id=sample.get("agent_id", "benchmark-agent"),
                tool_name=sample["tool_name"],
                arguments=sample.get("arguments", {}),
            )
            start = time.perf_counter()
            risk_score, _, _ = self.engine.evaluate_event(event)
            latency_ms = (time.perf_counter() - start) * 1000
            scores.append((risk_score.overall_score, sample["label"] == "malicious", latency_ms))

        thresholds = [self._metrics_at_threshold(scores, t) for t in (50.0, 80.0)]
        avg_latency = sum(s[2] for s in scores) / len(scores) if scores else 0.0

        return BenchmarkReport(
            total_samples=len(samples),
            thresholds=thresholds,
            avg_latency_ms=round(avg_latency, 3),
        )

    def _metrics_at_threshold(
        self, scores: list[tuple[float, bool, float]], threshold: float
    ) -> ThresholdMetrics:
        tp = fp = tn = fn = 0
        for score, is_malicious, _ in scores:
            predicted_malicious = score >= threshold
            if is_malicious and predicted_malicious:
                tp += 1
            elif not is_malicious and predicted_malicious:
                fp += 1
            elif not is_malicious and not predicted_malicious:
                tn += 1
            else:
                fn += 1

        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        fpr = fp / (fp + tn) if (fp + tn) else 0.0

        return ThresholdMetrics(
            threshold=threshold,
            precision=round(precision, 4),
            recall=round(recall, 4),
            fpr=round(fpr, 4),
            tp=tp,
            fp=fp,
            tn=tn,
            fn=fn,
        )

    def to_dict(self, report: BenchmarkReport) -> dict[str, Any]:
        return {
            "total_samples": report.total_samples,
            "dataset_version": self.dataset_version,
            "avg_latency_ms": report.avg_latency_ms,
            "thresholds": [
                {
                    "threshold": m.threshold,
                    "precision": m.precision,
                    "recall": m.recall,
                    "fpr": m.fpr,
                    "confusion_matrix": {"tp": m.tp, "fp": m.fp, "tn": m.tn, "fn": m.fn},
                }
                for m in report.thresholds
            ],
        }
