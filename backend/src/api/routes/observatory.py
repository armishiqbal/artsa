"""Observatory API — campaign heatmap, Red Queen metrics, regression status."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from src.benchmark.harness import BenchmarkHarness
from src.core.config import settings
from src.data.results_store import ResultsStore
from src.services.benchmark_cache import (
    benchmark_cache_was_hit,
    get_cached_ablation,
    get_cached_benchmark,
    set_cached_benchmark,
)
from src.services.scheduled_ablation import get_ablation_schedule_meta

router = APIRouter(tags=["Observatory"])


def _results_store() -> ResultsStore:
    return ResultsStore(data_dir=str(Path("./data/results")))


def _get_benchmark_report() -> dict[str, Any]:
    cached = get_cached_benchmark()
    if cached is not None:
        return cached

    harness = BenchmarkHarness()
    report = harness.to_dict(harness.run())
    set_cached_benchmark(report)
    return report


@router.get("/observatory")
async def get_observatory_data() -> dict[str, Any]:
    """Return live observatory metrics from ResultsStore and cached benchmark."""
    store = _results_store()
    campaign_ids = store.list_campaign_ids()

    heatmap: list[dict[str, Any]] = []
    red_queen_generations: list[dict[str, Any]] = []
    total_rounds = 0

    for cid in campaign_ids:
        rounds = store.load_rounds(cid)
        total_rounds += len(rounds)
        for rnd in rounds:
            day_key = rnd.timestamp.strftime("%Y-%m-%d")
            heatmap.append(
                {
                    "date": day_key,
                    "score": rnd.score.attack_success_score,
                    "verdict": rnd.score.verdict.value,
                    "campaign_id": cid,
                }
            )

    day_counts: dict[str, int] = defaultdict(int)
    day_scores: dict[str, list[int]] = defaultdict(list)
    for entry in heatmap:
        day_counts[entry["date"]] += 1
        day_scores[entry["date"]].append(entry["score"])

    today = datetime.now(UTC).date()
    heatmap_cells = []
    for offset in range(30):
        day = (today - timedelta(days=29 - offset)).isoformat()
        count = day_counts.get(day, 0)
        avg_score = sum(day_scores[day]) / len(day_scores[day]) if day_scores.get(day) else 0
        intensity = min(4, count // 3) if count else 0
        if avg_score >= 7:
            intensity = max(intensity, 3)
        heatmap_cells.append({"day": day, "rounds": count, "intensity": intensity})

    gen_scores: dict[int, list[int]] = defaultdict(list)
    for cid in campaign_ids:
        for rnd in store.load_rounds(cid):
            gen_scores[rnd.round_number].append(rnd.score.attack_success_score)

    for gen in sorted(gen_scores.keys())[:20]:
        scores = gen_scores[gen]
        # WS-2.6 (honesty): `blue_adaptation` was a pseudo-metric derived from
        # attack success (10 - avg), presented as if the Red Queen engine had
        # actually adapted defenses. The engine's `adapt_blue_defenses` is not
        # wired into campaign flow, so we only report measured attack success
        # plus an explicit `adaptation_measured: false` flag — never a fake
        # adaptation number.
        red_queen_generations.append(
            {
                "generation": gen,
                "attack_success": round(sum(scores) / len(scores), 1),
                "adaptation_measured": False,
                "adaptation_note": (
                    "Attack success trend only — the Red Queen adaptation loop "
                    "is not wired to campaign outcomes yet"
                ),
            }
        )

    benchmark = _get_benchmark_report()

    ablation = get_cached_ablation()

    rag_backend = "in_memory"
    if settings.USE_PINECONE_RAG and settings.is_key_configured("PINECONE_API_KEY"):
        rag_backend = "pinecone"
    elif settings.USE_CHROMA_RAG:
        rag_backend = "chroma"

    return {
        "total_rounds": total_rounds,
        "campaign_count": len(campaign_ids),
        "heatmap": heatmap_cells,
        "red_queen": red_queen_generations,
        "benchmark": benchmark,
        "regression_suite": _regression_status(benchmark),
        "benchmark_cached": benchmark_cache_was_hit(),
        "dataset_version": benchmark.get("dataset_version"),
        "ablation": ablation,
        "ablation_available": ablation is not None,
        "ablation_schedule": get_ablation_schedule_meta(),
        "platform": {
            "environment": settings.ENVIRONMENT,
            "rag_backend": rag_backend,
            "oidc_enabled": settings.ARTSA_OIDC_ENABLED,
            "auth_required": settings.auth_required,
            "use_sqlite": settings.USE_SQLITE,
            "use_celery": settings.USE_CELERY,
            "embedding_model": settings.resolve_embedding_model(),
        },
    }


def _regression_status(benchmark: dict[str, Any]) -> dict[str, Any]:
    thresholds = {t["threshold"]: t for t in benchmark.get("thresholds", [])}
    t80 = thresholds.get(80.0, {})
    t50 = thresholds.get(50.0, {})

    gates = [
        {
            "name": "containment_recall_at_80",
            "status": "PASSING" if t80.get("recall", 0) >= 0.4 else "FAILING",
            "severity": "CRITICAL",
            "value": t80.get("recall", 0),
        },
        {
            "name": "containment_fpr_at_50",
            "status": "PASSING" if t50.get("fpr", 1) <= 0.15 else "FAILING",
            "severity": "HIGH",
            "value": t50.get("fpr", 0),
        },
        {
            "name": "ingest_latency_slo",
            "status": "PASSING" if benchmark.get("avg_latency_ms", 999) < 50 else "FAILING",
            "severity": "MEDIUM",
            "value": benchmark.get("avg_latency_ms", 0),
        },
    ]
    passing = sum(1 for g in gates if g["status"] == "PASSING")
    return {"gates": gates, "passing": passing, "total": len(gates)}
