"""Shared risk-score → severity / verdict thresholds (aligned with frontend lib/severity.ts)."""

from __future__ import annotations

from typing import Literal

SeverityLabel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]

# CRITICAL / BREACHED
CRITICAL_RISK_THRESHOLD = 80.0
# HIGH / SUSPICIOUS (quarantine band)
HIGH_RISK_THRESHOLD = 50.0
SUSPICIOUS_RISK_THRESHOLD = HIGH_RISK_THRESHOLD
# MEDIUM
MEDIUM_RISK_THRESHOLD = 40.0


def severity_from_score(score: float) -> SeverityLabel:
    if score >= CRITICAL_RISK_THRESHOLD:
        return "CRITICAL"
    if score >= HIGH_RISK_THRESHOLD:
        return "HIGH"
    if score >= MEDIUM_RISK_THRESHOLD:
        return "MEDIUM"
    return "LOW"
