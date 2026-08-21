"""RAG Security Scanner — poisoned-chunk detection + adversarial-retrieval tests.

Reuses the containment engine so RAG corpus audits measure the same risk scores
as live agent ingest. Poisoned chunks are flagged when containment score >= 50.
Adversarial retrieval simulates embedding-ranked top-k and fails when a poison
chunk surfaces for a benign query or scores above the enforcement band.
"""

from __future__ import annotations

import uuid
from typing import Any

from src.containment.engine import ContainmentEngine
from src.core.models.events import ToolCallEvent
from src.core.severity import SUSPICIOUS_RISK_THRESHOLD
from src.data.embedding_manager import HighAccuracy1024EmbeddingFunction, cosine_similarity
from src.core.config import settings

POISON_THRESHOLD = float(SUSPICIOUS_RISK_THRESHOLD)


class RagSecurityScanner:
    """Scan RAG chunks and run adversarial retrieval regression tests."""

    def __init__(
        self,
        engine: ContainmentEngine | None = None,
        embedder: HighAccuracy1024EmbeddingFunction | None = None,
    ) -> None:
        self._engine = engine or ContainmentEngine()
        model = settings.resolve_embedding_model()
        self._embedder = embedder or HighAccuracy1024EmbeddingFunction(model_name=model)
        self._chunk_embeddings: dict[str, list[float]] = {}

    def _evaluate_text(self, text: str, *, tool_name: str = "query_vector_db") -> dict[str, Any]:
        event = ToolCallEvent(
            session_id=uuid.uuid4(),
            agent_id="rag-scanner",
            tool_name=tool_name,
            arguments={"query": text, "content": text},
        )
        risk, verdict, events, fired = self._engine.evaluate_with_attribution(event)
        return {
            "risk_score": risk.overall_score,
            "verdict": verdict.verdict,
            "recommended_action": verdict.recommended_action,
            "reasoning": verdict.reasoning,
            "flags": list(risk.flags),
            "fired_detectors": fired,
            "security_events": [
                {
                    "event_type": e.event_type,
                    "severity": e.severity,
                    "risk_score": e.risk_score,
                    "description": e.description,
                    "detector": e.detector,
                }
                for e in events
            ],
        }

    def scan_chunk(self, chunk_id: str, text: str) -> dict[str, Any]:
        """Score a single corpus chunk for indirect prompt injection / poison."""
        evaluation = self._evaluate_text(text)
        poisoned = evaluation["risk_score"] >= POISON_THRESHOLD
        return {
            "chunk_id": chunk_id,
            "text_preview": text[:240],
            "poisoned": poisoned,
            **evaluation,
        }

    def scan_corpus(self, chunks: list[dict[str, Any]]) -> dict[str, Any]:
        """Scan all chunks; return poison summary + per-chunk scores."""
        results: list[dict[str, Any]] = []
        for chunk in chunks:
            chunk_id = str(chunk.get("id") or chunk.get("chunk_id") or uuid.uuid4())
            text = str(chunk.get("text") or chunk.get("content") or "")
            if not text.strip():
                continue
            results.append(self.scan_chunk(chunk_id, text))

        poisoned = [r for r in results if r["poisoned"]]
        max_score = max((r["risk_score"] for r in results), default=0.0)
        return {
            "total_chunks": len(results),
            "poisoned_count": len(poisoned),
            "max_risk_score": max_score,
            "threshold": POISON_THRESHOLD,
            "chunks": results,
            "poisoned_ids": [r["chunk_id"] for r in poisoned],
        }

    def _embed_chunks(self, chunks: list[dict[str, Any]]) -> None:
        for chunk in chunks:
            chunk_id = str(chunk.get("id") or chunk.get("chunk_id") or uuid.uuid4())
            text = str(chunk.get("text") or chunk.get("content") or "")
            if chunk_id not in self._chunk_embeddings and text.strip():
                self._chunk_embeddings[chunk_id] = self._embedder.embed(text)

    def _rank_chunks(self, query: str, chunks: list[dict[str, Any]], top_k: int) -> list[dict[str, Any]]:
        if not chunks:
            return []
        query_emb = self._embedder.embed(query)
        ranked: list[tuple[float, dict[str, Any]]] = []
        for chunk in chunks:
            chunk_id = str(chunk.get("id") or chunk.get("chunk_id") or "")
            text = str(chunk.get("text") or chunk.get("content") or "")
            if not text.strip():
                continue
            if chunk_id not in self._chunk_embeddings:
                self._chunk_embeddings[chunk_id] = self._embedder.embed(text)
            sim = cosine_similarity(query_emb, self._chunk_embeddings[chunk_id])
            ranked.append((sim, {**chunk, "chunk_id": chunk_id, "similarity": round(sim, 4)}))
        ranked.sort(key=lambda pair: pair[0], reverse=True)
        return [item[1] for item in ranked[:top_k]]

    def adversarial_retrieval_test(
        self,
        corpus: list[dict[str, Any]],
        queries: list[dict[str, Any]],
        *,
        top_k: int = 3,
    ) -> dict[str, Any]:
        """Fail when poison-labelled chunks rank in top-k for benign queries."""
        self._embed_chunks(corpus)
        failures: list[dict[str, Any]] = []
        query_results: list[dict[str, Any]] = []

        for item in queries:
            query = str(item.get("query") or "")
            if not query.strip():
                continue
            ranked = self._rank_chunks(query, corpus, top_k=top_k)
            row_failures: list[dict[str, Any]] = []
            for hit in ranked:
                label = str(hit.get("label") or "unknown").lower()
                scan = self.scan_chunk(str(hit["chunk_id"]), str(hit.get("text") or hit.get("content") or ""))
                poison_label = label == "poison"
                containment_hit = scan["poisoned"]
                if poison_label or containment_hit:
                    row_failures.append(
                        {
                            "chunk_id": hit["chunk_id"],
                            "similarity": hit.get("similarity"),
                            "label": label,
                            "risk_score": scan["risk_score"],
                            "verdict": scan["verdict"],
                            "reason": "labelled_poison" if poison_label else "containment_poison",
                        }
                    )
            query_results.append({"query": query, "top_k": ranked, "failures": row_failures})
            failures.extend({"query": query, **f} for f in row_failures)

        return {
            "queries_tested": len(query_results),
            "top_k": top_k,
            "failure_count": len(failures),
            "passed": len(failures) == 0,
            "failures": failures,
            "queries": query_results,
        }


_scanner: RagSecurityScanner | None = None


def get_rag_scanner() -> RagSecurityScanner:
    global _scanner
    if _scanner is None:
        _scanner = RagSecurityScanner()
    return _scanner
