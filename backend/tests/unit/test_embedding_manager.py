"""Tests for embedding model resolution and hash fallback."""

import pytest
from src.data.embedding_manager import HighAccuracy1024EmbeddingFunction, cosine_similarity


def test_hash_embed_deterministic():
    embedder = HighAccuracy1024EmbeddingFunction(model_name="hash-1024")
    a = embedder.embed("test payload")
    b = embedder.embed("test payload")
    assert a == b
    assert len(a) == 1024


def test_cosine_identical_vectors():
    v = [1.0, 0.0, 0.0]
    assert abs(cosine_similarity(v, v) - 1.0) < 1e-6


def test_resolve_embedding_model_testing(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "testing")
    from src.core.config import Settings

    s = Settings()
    assert s.resolve_embedding_model() == "hash-1024"


def test_resolve_embedding_model_auto_without_fastembed(monkeypatch):
    """`auto` falls back to hash-1024 when the open-source FastEmbed dep is
    absent — and never selects a vendor API."""
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")  # must be ignored
    monkeypatch.setattr("src.data.embedding_manager.fastembed_available", lambda: False)
    from src.core.config import Settings

    s = Settings()
    s.ARTSA_EMBEDDING_MODEL = "auto"
    assert s.resolve_embedding_model() == "hash-1024"


def test_resolve_embedding_model_auto_uses_open_source(monkeypatch):
    """`auto` prefers the open-source local ONNX model when FastEmbed exists."""
    pytest.importorskip("fastembed")
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890")
    monkeypatch.setattr("src.data.embedding_manager.fastembed_available", lambda: True)
    from src.core.config import Settings

    s = Settings()
    s.ARTSA_EMBEDDING_MODEL = "auto"
    assert s.resolve_embedding_model() == "local-bge-small"
