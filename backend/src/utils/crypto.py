"""Crypto and hashing utilities."""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet


def hash_token(token: str) -> str:
    """Return SHA-256 hex digest of input token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _fernet(secret: str) -> Fernet:
    """Build a Fernet cipher from an arbitrary secret string.

    The secret is hashed to a stable 32-byte urlsafe base64 key so any
    SECRET_KEY length works.
    """
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(plaintext: str, secret: str) -> str:
    """Encrypt ``plaintext`` (e.g. a provider API key) for storage at rest."""
    return _fernet(secret).encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str, secret: str) -> str:
    """Decrypt a value produced by :func:`encrypt_secret`."""
    return _fernet(secret).decrypt(token.encode("utf-8")).decode("utf-8")
