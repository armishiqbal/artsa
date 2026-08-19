"""Mutation diversity measurement — Task List Phase 2.2.

Embed every variant and report how *spread out* the corpus is. A red-team
generator that collapses into a few phrasings is useless; coverage over the
embedding space is what forces the guardrail's semantic layer to actually
generalize.
"""

from __future__ import annotations

from dataclasses import dataclass

from src.data.embedding_manager import HighAccuracy1024EmbeddingFunction, cosine_similarity


@dataclass
class DiversityReport:
    corpus_size: int
    mean_pairwise_distance: float
    distinct_clusters: int
    cluster_threshold: float
    min_pairwise_distance: float

    def to_dict(self) -> dict:
        return {
            "corpus_size": self.corpus_size,
            "mean_pairwise_distance": round(self.mean_pairwise_distance, 4),
            "distinct_clusters": self.distinct_clusters,
            "cluster_threshold": self.cluster_threshold,
            "min_pairwise_distance": round(self.min_pairwise_distance, 4),
        }


def mutation_diversity(
    texts: list[str],
    cluster_threshold: float = 0.95,
    model_name: str | None = None,
) -> DiversityReport:
    """Compute pairwise embedding diversity of a set of attack variants."""
    if len(texts) < 2:
        return DiversityReport(
            corpus_size=len(texts), mean_pairwise_distance=0.0,
            distinct_clusters=len(texts), cluster_threshold=cluster_threshold,
            min_pairwise_distance=0.0,
        )

    embedder = HighAccuracy1024EmbeddingFunction(model_name=model_name)
    vectors = [embedder.embed(t) for t in texts]

    distances: list[float] = []
    clusters = 0
    for i in range(len(vectors)):
        assigned = False
        for j in range(i):
            sim = cosine_similarity(vectors[i], vectors[j])
            if sim >= cluster_threshold:
                assigned = True
                break
            distances.append(1.0 - sim)
        if not assigned:
            clusters += 1

    mean_dist = (sum(distances) / len(distances)) if distances else 0.0
    return DiversityReport(
        corpus_size=len(texts),
        mean_pairwise_distance=mean_dist,
        distinct_clusters=max(clusters, 1),
        cluster_threshold=cluster_threshold,
        min_pairwise_distance=min(distances) if distances else 0.0,
    )


def diversity_is_healthy(report: DiversityReport, min_mean: float = 0.15) -> bool:
    """A corpus is only useful for testing if variants actually spread out."""
    return report.mean_pairwise_distance >= min_mean and report.distinct_clusters >= 2
