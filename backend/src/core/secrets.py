"""Secret masking and key-status helpers — never log or expose raw values."""

from __future__ import annotations

from typing import Optional


def mask_secret(value: Optional[str], visible: int = 4) -> Optional[str]:
    """Return a masked representation suitable for UI display."""
    if not value or not value.strip():
        return None
    v = value.strip()
    if len(v) <= visible * 2:
        return "*" * len(v)
    return f"{v[:visible]}…{v[-visible:]}"


def key_status(value: Optional[str]) -> str:
    """Return configured | missing | placeholder."""
    if not value or not str(value).strip():
        return "missing"
    lowered = str(value).strip().lower()
    if lowered in ("mock-key", "mock-key-for-testing", "change-me-in-production", "your-key-here", "sk-your-key-here"):
        return "placeholder"
    if lowered.startswith("your-") or lowered.endswith("-here"):
        return "placeholder"
    return "configured"
