"""ARTSA Platform Custom Exceptions."""

class ArtsaException(Exception):
    """Base exception for all ARTSA platform errors."""


class ContainmentBreachException(ArtsaException):
    """Raised when an autonomous agent breaches sandbox containment limits."""


class AgentQuarantinedException(ArtsaException):
    """Raised when an operation is attempted on a quarantined agent."""


class DatabaseConnectionException(ArtsaException):
    """Raised when database operations fail."""
