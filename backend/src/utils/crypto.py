"""Crypto and hashing utilities."""

import hashlib


def hash_token(token: str) -> str:
    """Return SHA-256 hex digest of input token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
