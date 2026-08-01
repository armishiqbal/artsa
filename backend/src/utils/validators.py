"""Validation helper utilities."""

import uuid


def validate_uuid(val: str) -> bool:
    """Check if string is valid UUID4."""
    try:
        uuid.UUID(val)
        return True
    except ValueError:
        return False
