"""ARTSA Platform Constants."""

MAX_RISK_SCORE = 100.0
MIN_RISK_SCORE = 0.0
EDS_LATENCY_MAX_MS = 50.0

HIGH_RISK_PATTERNS = [
    r"(?i)rm\s+-rf",
    r"(?i)/etc/passwd",
    r"(?i)/etc/shadow",
    r"(?i)nc\s+-e",
    r"(?i)bash\s+-i",
    r"(?i)system override",
    r"(?i)ignore previous instructions",
    r"(?i)exfiltrate",
]
