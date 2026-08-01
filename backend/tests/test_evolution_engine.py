"""Tests for the EvolutionEngine — NO mocking, real instances only."""

import pytest

from src.evolution.engine import EvolutionEngine, Individual
from src.models import (
    AttackCategory,
    AttackPayload,
    JudgeScore,
    Severity,
    Verdict,
)


def _make_payload(name: str = "test", category=AttackCategory.PROMPT_INJECTION) -> AttackPayload:
    """Helper to quickly build an AttackPayload."""
    return AttackPayload(
        category=category,
        name=name,
        prompt=f"Attack prompt for {name}. This is a detailed multi-sentence payload.",
        objective="Test objective",
    )


def _make_score(success: int = 5) -> JudgeScore:
    """Helper to build a JudgeScore with a given attack_success_score."""
    verdict = Verdict.SUCCESS if success >= 7 else (Verdict.PARTIAL if success >= 3 else Verdict.BLOCKED)
    return JudgeScore(
        verdict=verdict,
        attack_success_score=success,
        severity=Severity.MEDIUM,
        bypass_depth=min(success // 3, 4),
        information_leakage_score=success,
        defense_quality_score=10 - success,
    )


def _add_n_results(engine: EvolutionEngine, n: int, score_start: int = 1) -> None:
    """Add N results with incrementing scores to the engine."""
    for i in range(n):
        s = min(score_start + i, 10)
        engine.add_result(_make_payload(f"attack-{i}"), _make_score(s))


class TestEvolutionEngine:
    def test_initial_state(self):
        """Engine starts with empty population and generation 0."""
        engine = EvolutionEngine()
        assert len(engine.population) == 0
        assert engine.current_generation == 0

    def test_add_result(self):
        """add_result grows the population by 1."""
        engine = EvolutionEngine()
        engine.add_result(_make_payload(), _make_score(5))
        assert len(engine.population) == 1

    def test_add_result_tracks_fitness(self):
        """Fitness is set to attack_success_score."""
        engine = EvolutionEngine()
        engine.add_result(_make_payload(), _make_score(7))
        assert engine.population[0].fitness == 7

    def test_should_evolve_false_when_not_enough_rounds(self):
        """should_evolve returns False before generation_interval rounds."""
        engine = EvolutionEngine(generation_interval=5)
        _add_n_results(engine, 3)
        assert engine.should_evolve() is False

    def test_should_evolve_true_when_enough_rounds(self):
        """should_evolve returns True after generation_interval rounds."""
        engine = EvolutionEngine(generation_interval=5)
        _add_n_results(engine, 5)
        assert engine.should_evolve() is True

    def test_next_generation_creates_new_population(self):
        """next_generation produces a new population of population_size."""
        engine = EvolutionEngine(population_size=10, generation_interval=5)
        _add_n_results(engine, 6, score_start=2)
        new_pop = engine.next_generation()
        assert len(new_pop) >= engine.population_size

    def test_next_generation_preserves_elites(self):
        """Elites (top fitness) survive into the next generation unchanged."""
        engine = EvolutionEngine(population_size=10, elite_count=2, generation_interval=3)
        # Add results with known scores
        engine.add_result(_make_payload("low"), _make_score(1))
        engine.add_result(_make_payload("mid"), _make_score(5))
        engine.add_result(_make_payload("high"), _make_score(9))
        
        # Record the top 2 IDs
        ranked = sorted(engine.population, key=lambda x: x.fitness, reverse=True)
        elite_ids = {ranked[0].id, ranked[1].id}
        
        engine.next_generation()
        
        new_ids = {ind.id for ind in engine.population}
        # At least the elite IDs should still be present
        assert elite_ids.issubset(new_ids)

    def test_next_generation_increments_generation_counter(self):
        """next_generation increments current_generation."""
        engine = EvolutionEngine(generation_interval=2)
        _add_n_results(engine, 3)
        engine.next_generation()
        assert engine.current_generation == 1

    def test_get_best_candidate_returns_highest_fitness(self):
        """get_best_candidate returns the individual with highest fitness."""
        engine = EvolutionEngine()
        engine.add_result(_make_payload("weak"), _make_score(2))
        engine.add_result(_make_payload("strong"), _make_score(9))
        engine.add_result(_make_payload("mid"), _make_score(5))
        
        best = engine.get_best_candidate()
        assert best is not None
        assert best.fitness == 9

    def test_get_best_candidate_returns_none_when_empty(self):
        """get_best_candidate returns None on empty population."""
        engine = EvolutionEngine()
        assert engine.get_best_candidate() is None

    def test_get_evolution_summary_structure(self):
        """get_evolution_summary returns a dict with expected keys."""
        engine = EvolutionEngine()
        _add_n_results(engine, 3)
        summary = engine.get_evolution_summary()
        assert "current_generation" in summary
        assert "population_size" in summary
        assert "all_time_best_fitness" in summary
        assert "all_time_best_attack" in summary
        assert "generation_stats" in summary

    def test_population_doesnt_exceed_max_size(self):
        """Population is trimmed when it grows too large."""
        engine = EvolutionEngine(population_size=5)
        # Add many more than 2x population_size to trigger trim
        _add_n_results(engine, 15, score_start=1)
        # After trim, population should be <= population_size * 2
        assert len(engine.population) <= engine.population_size * 2
        # If we trim manually, it should go down to population_size
        engine._trim_population()
        assert len(engine.population) == engine.population_size

