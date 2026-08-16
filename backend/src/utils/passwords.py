"""Password hashing for local user accounts.

PBKDF2-HMAC-SHA256 from the standard library — no native extension, auditable,
and with a high iteration count it resists offline brute force. A random 16-byte
salt is generated per password and stored alongside the digest so two users with
the same password never share a stored hash.

Storage format: ``pbkdf2_sha256$<iterations>$<salt_hex>$<digest_hex>``
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

_PBKDF2_ITERATIONS = 600_000
_ALGO = "pbkdf2_sha256"


def hash_password(password: str) -> str:
    """Return a self-describing salted PBKDF2 digest for the given password."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), _PBKDF2_ITERATIONS
    )
    return f"{_ALGO}${_PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Constant-time check of a password against a stored digest."""
    try:
        algo, iterations, salt_hex, expected = stored.split("$")
        if algo != _ALGO:
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(digest.hex(), expected)
    except (ValueError, TypeError, AttributeError):
        return False
