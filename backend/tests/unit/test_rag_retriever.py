"""RAG retriever tests."""

from src.agents.rag.retriever import RAGRetriever


def test_rag_retrieve_returns_chunks():
    retriever = RAGRetriever(top_k=3)
    chunks = retriever.retrieve("delete user admin privilege escalation")
    assert len(chunks) <= 3
    assert chunks[0].score > 0
    assert "policy" in chunks[0].source or "tool" in chunks[0].source


def test_rag_format_context():
    retriever = RAGRetriever(top_k=2)
    chunks = retriever.retrieve("exfiltrate data")
    text = retriever.format_context(chunks)
    assert "RETRIEVED KNOWLEDGE" in text
