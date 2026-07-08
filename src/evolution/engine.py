"""Evolutionary Engine — Genetic algorithm for attack strategy evolution.

Treats red-teaming as an optimization problem. Each attack's Judge score
becomes a fitness signal. Successful attacks survive, mutate, and crossover
to produce increasingly sophisticated attack chains.

Lifecycle:
    1. Red Team generates an attack → sends to Target → Judge scores it
    2. Result is fed into the engine via `add_result()`
    3. After every `generation_interval` rounds, `next_generation()` is called
    4. The engine selects parents, performs crossover + mutation, produces offspring
    5. `get_best_candidate()` returns the top-fitness attack for the Red Team to adapt
"""

from __future__ import annotations

import logging
import random
import uuid
from dataclasses import dataclass, field
from typing import Any

from src.attacks.payload_mutator import PayloadMutator
from src.models import AttackCategory, AttackPayload, JudgeScore, Verdict

logger = logging.getLogger(__name__)


@dataclass
class Individual:
    """A single individual in the evolutionary population.

    Wraps an AttackPayload with fitness metadata so the engine can
    select, crossover, and mutate based on performance.
    """

    payload: AttackPayload
    fitness: float = 0.0  # Judge's attack_success_score (0-10)
    generation: int = 0
    parent_ids: list[str] = field(default_factory=list)
    verdict: Verdict = Verdict.BLOCKED

    @property
    def id(self) -> str:
        return self.payload.id

    @property
    def category(self) -> AttackCategory:
        return self.payload.category


class EvolutionEngine:
    """Genetic algorithm engine for evolving attack strategies.

    The engine maintains a population of attack individuals ranked by
    fitness. After each generation interval, it performs selection,
    crossover, and mutation to produce a new generation of attacks.

    Args:
        population_size: Maximum number of individuals to keep.
        elite_count: Number of top individuals preserved unchanged each generation.
        mutation_rate: Probability (0-1) of mutating an offspring.
        crossover_rate: Probability (0-1) of performing crossover vs. cloning.
        generation_interval: How many rounds between evolution cycles.
        tournament_size: Number of individuals in each tournament selection.
    """

    def __init__(
        self,
        population_size: int = 20,
        elite_count: int = 3,
        mutation_rate: float = 0.7,
        crossover_rate: float = 0.5,
        generation_interval: int = 5,
        tournament_size: int = 3,
    ) -> None:
        self.population_size = population_size
        self.elite_count = min(elite_count, population_size)
        self.mutation_rate = mutation_rate
        self.crossover_rate = crossover_rate
        self.generation_interval = generation_interval
        self.tournament_size = tournament_size

        self.population: list[Individual] = []
        self.current_generation: int = 0
        self.rounds_since_evolution: int = 0
        self.all_time_best: Individual | None = None

        # Stats tracking
        self.generation_stats: list[dict[str, Any]] = []

    def add_result(self, payload: AttackPayload, score: JudgeScore) -> None:
        """Feed a round result into the population.

        Called after every round. The payload + score become a new individual
        that joins the population pool.
        """
        individual = Individual(
            payload=payload,
            fitness=score.attack_success_score,
            generation=self.current_generation,
            verdict=score.verdict,
        )

        self.population.append(individual)

        # Track all-time best
        if self.all_time_best is None or individual.fitness > self.all_time_best.fitness:
            self.all_time_best = individual

        self.rounds_since_evolution += 1

        # Trim to population_size (keep best)
        if len(self.population) > self.population_size * 2:
            self._trim_population()

        logger.debug(
            "Added individual %s (fitness=%.1f, gen=%d) | Population: %d",
            individual.id[:8],
            individual.fitness,
            individual.generation,
            len(self.population),
        )

    def should_evolve(self) -> bool:
        """Check if it's time to run the next evolution cycle."""
        return self.rounds_since_evolution >= self.generation_interval

    def next_generation(self) -> list[Individual]:
        """Produce the next generation of attack candidates.

        Performs:
            1. Sort population by fitness
            2. Elitism: preserve top N unchanged
            3. Tournament selection of parents
            4. Crossover: combine parent prompts
            5. Mutation: apply PayloadMutator transformations

        Returns:
            The new generation of individuals.
        """
        if len(self.population) < 2:
            logger.info("Population too small (%d) to evolve, skipping.", len(self.population))
            return self.population

        self.current_generation += 1
        self.rounds_since_evolution = 0

        # Sort by fitness (descending)
        ranked = sorted(self.population, key=lambda x: x.fitness, reverse=True)

        # 1. Elitism — top performers survive unchanged
        elites = ranked[: self.elite_count]
        new_population = list(elites)

        # 2. Fill rest via selection + crossover + mutation
        while len(new_population) < self.population_size:
            if random.random() < self.crossover_rate and len(ranked) >= 2:
                parent_a = self._tournament_select(ranked)
                parent_b = self._tournament_select(ranked)
                # Avoid self-crossover
                attempts = 0
                while parent_b.id == parent_a.id and attempts < 5:
                    parent_b = self._tournament_select(ranked)
                    attempts += 1

                offspring = self._crossover(parent_a, parent_b)
            else:
                # Clone a tournament winner
                parent = self._tournament_select(ranked)
                offspring = Individual(
                    payload=AttackPayload(
                        id=str(uuid.uuid4()),
                        template_id=parent.payload.template_id,
                        category=parent.category,
                        name=f"{parent.payload.name}",
                        prompt=parent.payload.prompt,
                        objective=parent.payload.objective,
                        mutations_applied=list(parent.payload.mutations_applied),
                        metadata=dict(parent.payload.metadata),
                    ),
                    fitness=0.0,  # Untested — fitness resets
                    generation=self.current_generation,
                    parent_ids=[parent.id],
                )

            # 3. Maybe mutate
            if random.random() < self.mutation_rate:
                offspring = self._mutate(offspring)

            new_population.append(offspring)

        self.population = new_population

        # Log generation stats
        avg_fitness = sum(i.fitness for i in ranked) / len(ranked) if ranked else 0
        best_fitness = ranked[0].fitness if ranked else 0
        stats = {
            "generation": self.current_generation,
            "population_size": len(self.population),
            "avg_fitness": round(avg_fitness, 2),
            "best_fitness": best_fitness,
            "elite_count": len(elites),
        }
        self.generation_stats.append(stats)
        logger.info(
            "Generation %d complete: pop=%d, avg_fitness=%.2f, best=%.1f",
            self.current_generation,
            len(self.population),
            avg_fitness,
            best_fitness,
        )

        return self.population

    def get_best_candidate(self, category: AttackCategory | None = None) -> Individual | None:
        """Return the highest-fitness individual, optionally filtered by category.

        Used by the Red Team to pick an evolved attack instead of a random template.
        """
        pool = self.population
        if category:
            pool = [i for i in pool if i.category == category]

        if not pool:
            return None

        return max(pool, key=lambda x: x.fitness)

    def get_candidates_for_category(
        self,
        category: AttackCategory,
        k: int = 3,
    ) -> list[Individual]:
        """Return the top-k candidates for a specific attack category."""
        pool = [i for i in self.population if i.category == category]
        ranked = sorted(pool, key=lambda x: x.fitness, reverse=True)
        return ranked[:k]

    # ─── Private Methods ───────────────────────────────────────────────

    def _tournament_select(self, ranked: list[Individual]) -> Individual:
        """Tournament selection: pick `tournament_size` random individuals, return the fittest."""
        contestants = random.sample(
            ranked,
            min(self.tournament_size, len(ranked)),
        )
        return max(contestants, key=lambda x: x.fitness)

    def _crossover(self, parent_a: Individual, parent_b: Individual) -> Individual:
        """Crossover two parents by combining their attack prompts.

        Strategy: Split each parent's prompt roughly in half,
        take the first half of parent_a and the second half of parent_b.
        This preserves the opening framing of one attack with the
        payload delivery of another.
        """
        prompt_a = parent_a.payload.prompt
        prompt_b = parent_b.payload.prompt

        # Split at sentence boundaries (roughly midpoint)
        sentences_a = prompt_a.replace(". ", ".\n").split("\n")
        sentences_b = prompt_b.replace(". ", ".\n").split("\n")

        mid_a = max(1, len(sentences_a) // 2)
        mid_b = max(1, len(sentences_b) // 2)

        # First half from A, second half from B
        child_prompt = " ".join(sentences_a[:mid_a]) + " " + " ".join(sentences_b[mid_b:])

        # Inherit the category from the fitter parent
        fitter_parent = parent_a if parent_a.fitness >= parent_b.fitness else parent_b

        child_payload = AttackPayload(
            id=str(uuid.uuid4()),
            template_id=fitter_parent.payload.template_id,
            category=fitter_parent.category,
            name=f"Evolved: {fitter_parent.payload.name} × {('A' if fitter_parent is parent_a else 'B')}",
            prompt=child_prompt.strip(),
            objective=fitter_parent.payload.objective,
            mutations_applied=["crossover"],
            metadata={
                **fitter_parent.payload.metadata,
                "parents": [parent_a.id[:8], parent_b.id[:8]],
                "generation": self.current_generation,
            },
        )

        return Individual(
            payload=child_payload,
            fitness=0.0,  # Untested
            generation=self.current_generation,
            parent_ids=[parent_a.id, parent_b.id],
        )

    def _mutate(self, individual: Individual) -> Individual:
        """Apply a random payload mutation to an individual."""
        mutated_prompt, mutation_names = PayloadMutator.apply_mutations(
            individual.payload.prompt, n=1
        )

        individual.payload.prompt = mutated_prompt
        individual.payload.mutations_applied.extend(mutation_names)
        individual.payload.name = f"{individual.payload.name} (Mutated)"

        return individual

    def _trim_population(self) -> None:
        """Trim population to population_size, keeping the best."""
        self.population.sort(key=lambda x: x.fitness, reverse=True)
        self.population = self.population[: self.population_size]

    def get_evolution_summary(self) -> dict[str, Any]:
        """Return a summary of evolution progress for reporting."""
        return {
            "current_generation": self.current_generation,
            "population_size": len(self.population),
            "all_time_best_fitness": self.all_time_best.fitness if self.all_time_best else 0,
            "all_time_best_attack": self.all_time_best.payload.name if self.all_time_best else "",
            "generation_stats": self.generation_stats,
        }
