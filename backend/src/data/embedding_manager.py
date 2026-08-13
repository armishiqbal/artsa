"""Embedding utilities for semantic detection and RAG."""

from __future__ import annotations

import hashlib
import logging
import math
from collections.abc import Iterable

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)

AVAILABLE_EMBEDDING_MODELS = {
    "hash-1024": {
        "dimensions": 1024,
        "description": "Deterministic hash-based embedding for offline/test runs",
    },
    "text-embedding-3-large": {
        "dimensions": 3072,
        "description": "OpenAI text-embedding-3-large (production)",
    },
    "text-embedding-3-small": {
        "dimensions": 1536,
        "description": "OpenAI text-embedding-3-small",
    },
}


def _pad_or_truncate(vector: list[float], dimensions: int) -> list[float]:
    if len(vector) >= dimensions:
        return vector[:dimensions]
    return vector + [0.0] * (dimensions - len(vector))


class HighAccuracy1024EmbeddingFunction:
    """Embedding function with hash fallback and optional OpenAI API."""

    TARGET_DIMENSIONS = 1024

    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or settings.resolve_embedding_model()
        meta = AVAILABLE_EMBEDDING_MODELS.get(self.model_name, {})
        self.dimensions = self.TARGET_DIMENSIONS
        self._api_dimensions = int(meta.get("dimensions", self.TARGET_DIMENSIONS))
        self._openai_base = (settings.OPENAI_BASE_URL or "https://api.openai.com/v1").rstrip("/")

    def embed(self, text: str) -> list[float]:
        if self.model_name == "hash-1024":
            return self._hash_embed(text)
        if self.model_name.startswith("text-embedding"):
            try:
                return self._openai_embed(text)
            except Exception as exc:
                logger.warning("OpenAI embed failed (%s), falling back to hash-1024", exc)
                return self._hash_embed(text)
        return self._hash_embed(text)

    def embed_batch(self, texts: Iterable[str]) -> list[list[float]]:
        return [self.embed(text) for text in texts]

    def _openai_embed(self, text: str) -> list[float]:
        api_key = settings.OPENAI_API_KEY
        if not api_key or not settings.is_key_configured("OPENAI_API_KEY"):
            raise RuntimeError("OpenAI API key not configured")

        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{self._openai_base}/embeddings",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": self.model_name, "input": text},
            )
            response.raise_for_status()
            data = response.json()

        vector = data["data"][0]["embedding"]
        normalized = _pad_or_truncate(list(vector), self.TARGET_DIMENSIONS)
        norm = math.sqrt(sum(v * v for v in normalized)) or 1.0
        return [v / norm for v in normalized]

    def _hash_embed(self, text: str) -> list[float]:
        digest = hashlib.sha256(text.lower().encode("utf-8")).digest()
        values: list[float] = []
        while len(values) < self.dimensions:
            for byte in digest:
                values.append((byte / 255.0) * 2 - 1)
                if len(values) >= self.dimensions:
                    break
            digest = hashlib.sha256(digest).digest()
        norm = math.sqrt(sum(v * v for v in values)) or 1.0
        return [v / norm for v in values]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    length = min(len(a), len(b))
    dot = sum(a[i] * b[i] for i in range(length))
    norm_a = math.sqrt(sum(x * x for x in a[:length])) or 1.0
    norm_b = math.sqrt(sum(y * y for y in b[:length])) or 1.0
    return dot / (norm_a * norm_b)
