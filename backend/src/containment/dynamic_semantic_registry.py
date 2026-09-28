"""Dynamic Semantic Registry for Closed-Loop Adaptive Defense.

When the Defender Agent contains an adversarial breach, it registers the breach
payload in this registry. The payload is embedded into high-accuracy vectors so
that downstream input guardrails (DynamicSemanticGuardrailAdapter) can block
both the exact payload AND its semantic paraphrases using cosine similarity,
preventing trivial regex evasion through synonym substitution.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from threading import RLock
from typing import Any, ClassVar

from pydantic import BaseModel, Field

from src.core.config import settings
from src.data.embedding_manager import (
    EmbeddingUnavailable,
    HighAccuracy1024EmbeddingFunction,
    cosine_similarity,
)
from src.utils.obfuscation import semantic_candidates

logger = logging.getLogger(__name__)


class DynamicBreachRecord(BaseModel):
    """A registered breach payload and its computed embedding vector."""

    id: str
    phrase: str
    vector: list[float]
    campaign_id: str = ""
    round_id: int = 1
    category: str = "PROMPT_INJECTION"
    timestamp: float = 0.0


class DynamicSemanticRegistry:
    """Thread-safe dynamic registry of breach vectors used for adaptive semantic filtering."""

    _instance: ClassVar[DynamicSemanticRegistry | None] = None
    _lock: ClassVar[RLock] = RLock()

    def __init__(
        self,
        persist_path: str | Path | None = None,
        embedder: Any = None,
    ) -> None:
        self._records: list[DynamicBreachRecord] = []
        self._mutex = RLock()
        if embedder is not None:
            self._embedder = embedder
        else:
            model = settings.resolve_embedding_model()
            self._embedder = HighAccuracy1024EmbeddingFunction(model_name=model)
        self.persist_path = Path(persist_path) if persist_path else None
        if self.persist_path and self.persist_path.exists():
            self._load_from_disk()

    @classmethod
    def get_instance(cls) -> DynamicSemanticRegistry:
        """Get or initialize the shared singleton instance."""
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """Reset the singleton instance (primarily for test isolation)."""
        with cls._lock:
            cls._instance = None

    def _load_from_disk(self) -> None:
        if not self.persist_path or not self.persist_path.exists():
            return
        try:
            with self.persist_path.open("r", encoding="utf-8") as f:
                raw = json.load(f)
            records = [DynamicBreachRecord.model_validate(r) for r in raw]
            with self._mutex:
                self._records = records
            logger.info("Loaded %d dynamic breach records from %s", len(records), self.persist_path)
        except Exception as exc:
            logger.warning("Failed to load dynamic breach embeddings from %s: %s", self.persist_path, exc)

    def _save_to_disk(self) -> None:
        if not self.persist_path:
            return
        try:
            self.persist_path.parent.mkdir(parents=True, exist_ok=True)
            with self._mutex:
                data = [r.model_dump(mode="json") for r in self._records]
            with self.persist_path.open("w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as exc:
            logger.warning("Failed to save dynamic breach embeddings to %s: %s", self.persist_path, exc)

    def register_breach(
        self,
        phrase: str,
        *,
        campaign_id: str = "",
        round_id: int = 1,
        category: str = "PROMPT_INJECTION",
    ) -> DynamicBreachRecord | None:
        """Embed and register a novel breach payload into the dynamic semantic pool."""
        clean_phrase = phrase.strip()
        if len(clean_phrase) < 5:
            return None

        import time
        import uuid

        try:
            vector = self._embedder.embed(clean_phrase)
        except EmbeddingUnavailable as exc:
            logger.warning("Embedding backend unavailable for dynamic breach registration: %s", exc)
            return None
        except Exception as exc:
            logger.warning("Failed to embed breach phrase: %s", exc)
            return None

        record = DynamicBreachRecord(
            id=f"breach_{uuid.uuid4().hex[:10]}",
            phrase=clean_phrase,
            vector=vector,
            campaign_id=campaign_id,
            round_id=round_id,
            category=category,
            timestamp=time.time(),
        )

        with self._mutex:
            self._records.append(record)
            logger.info(
                "DynamicSemanticRegistry registered breach [%s] in %s: '%s...'",
                record.id,
                category,
                clean_phrase[:60],
            )

        self._save_to_disk()
        return record

    def check_similarity(
        self,
        text: str,
        threshold: float = 0.72,
    ) -> tuple[bool, float, DynamicBreachRecord | None]:
        """Check if incoming text matches any registered breach embeddings.

        Evaluates both raw text and de-obfuscated semantic candidates.
        Returns (is_match, similarity_score, matched_record).
        """
        clean_text = text.strip()
        if len(clean_text) < 5:
            return False, 0.0, None

        with self._mutex:
            if not self._records:
                return False, 0.0, None
            candidate_records = list(self._records)

        best_sim = 0.0
        best_record = None

        candidates = list(semantic_candidates(clean_text))
        if clean_text not in candidates:
            candidates.insert(0, clean_text)

        is_hash_mode = getattr(self._embedder, "model_name", "") == "hash-1024"

        for cand in candidates:
            try:
                query_vector = self._embedder.embed(cand)
            except EmbeddingUnavailable:
                continue
            except Exception as exc:
                logger.warning("Failed to embed query candidate for semantic check: %s", exc)
                continue

            cand_tokens = set(re.findall(r"\w{3,}", cand.lower()))

            for rec in candidate_records:
                sim = cosine_similarity(query_vector, rec.vector)

                if is_hash_mode:
                    rec_tokens = set(re.findall(r"\w{3,}", rec.phrase.lower()))
                    if cand_tokens and rec_tokens:
                        intersection = len(cand_tokens & rec_tokens)
                        union = len(cand_tokens | rec_tokens)
                        jaccard = intersection / union if union > 0 else 0.0
                        overlap_ratio = intersection / min(len(cand_tokens), len(rec_tokens))
                        sim = max(sim, jaccard, overlap_ratio * 0.85)

                if sim > best_sim:
                    best_sim = sim
                    best_record = rec

                if best_sim >= 0.98:
                    break

            if best_sim >= threshold:
                break

        is_match = best_sim >= threshold
        return is_match, best_sim, best_record

    def clear(self) -> None:
        """Clear all registered breach records."""
        with self._mutex:
            self._records.clear()
        self._save_to_disk()

    @property
    def count(self) -> int:
        with self._mutex:
            return len(self._records)
