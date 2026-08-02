"""JSON-backed campaign and round storage utilities."""

from __future__ import annotations

import json
from pathlib import Path

from src.models import CampaignConfig, CampaignSummary, RoundResult, Verdict


class ResultsStore:
    """Persists campaign configs and round results as JSON files."""

    def __init__(self, data_dir: str) -> None:
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def _campaign_dir(self, campaign_id: str) -> Path:
        path = self.data_dir / campaign_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _rounds_path(self, campaign_id: str) -> Path:
        return self._campaign_dir(campaign_id) / "rounds.json"

    def save_campaign_config(self, config: CampaignConfig) -> None:
        path = self._campaign_dir(config.id) / "config.json"
        path.write_text(json.dumps(config.model_dump(mode="json"), indent=2), encoding="utf-8")

    def save_round(self, campaign_id: str, round_result: RoundResult) -> None:
        path = self._rounds_path(campaign_id)
        rows: list[dict] = []
        if path.exists():
            rows = json.loads(path.read_text(encoding="utf-8"))
        rows.append(round_result.model_dump(mode="json"))
        path.write_text(json.dumps(rows, indent=2), encoding="utf-8")

    def load_rounds(self, campaign_id: str) -> list[RoundResult]:
        path = self._rounds_path(campaign_id)
        if not path.exists():
            return []
        rows = json.loads(path.read_text(encoding="utf-8"))
        return [RoundResult.model_validate(row) for row in rows]

    def list_campaign_ids(self) -> list[str]:
        if not self.data_dir.exists():
            return []
        return sorted(
            p.name for p in self.data_dir.iterdir() if p.is_dir() and (p / "rounds.json").exists()
        )

    def generate_summary(self, campaign_id: str, config: CampaignConfig) -> CampaignSummary:
        rounds = self.load_rounds(campaign_id)
        verdict_counts: dict[str, int] = {}
        severity_counts: dict[str, int] = {}
        by_category: dict[str, dict] = {}

        for result in rounds:
            verdict = result.score.verdict.value
            severity = result.score.severity.value
            verdict_counts[verdict] = verdict_counts.get(verdict, 0) + 1
            severity_counts[severity] = severity_counts.get(severity, 0) + 1

            cat = result.attack.category.value
            category_row = by_category.setdefault(
                cat,
                {"attempts": 0, "success": 0, "partial": 0, "blocked": 0, "total_score": 0},
            )
            category_row["attempts"] += 1
            category_row["total_score"] += result.score.attack_success_score
            if verdict == Verdict.SUCCESS.value:
                category_row["success"] += 1
            elif verdict == Verdict.PARTIAL.value:
                category_row["partial"] += 1
            else:
                category_row["blocked"] += 1

        for row in by_category.values():
            attempts = row["attempts"] or 1
            row["avg_score"] = row["total_score"] / attempts

        total = len(rounds)
        return CampaignSummary(
            campaign_id=campaign_id,
            name=config.name,
            total_rounds=config.max_rounds,
            completed_rounds=total,
            results_by_verdict=verdict_counts,
            results_by_severity=severity_counts,
            results_by_category=by_category,
            avg_attack_success=sum(r.score.attack_success_score for r in rounds) / total if total else 0.0,
            avg_defense_quality=sum(r.score.defense_quality_score for r in rounds) / total if total else 0.0,
            avg_bypass_depth=sum(r.score.bypass_depth for r in rounds) / total if total else 0.0,
        )
