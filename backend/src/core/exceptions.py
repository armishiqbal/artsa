"""ARTSA Platform Custom Exceptions."""

class ArtsaException(Exception):
    """Base exception for all ARTSA platform errors."""
    pass


class ContainmentBreachException(ArtsaException):
    """Raised when an autonomous agent breaches sandbox containment limits."""
    pass


class AgentQuarantinedException(ArtsaException):
    """Raised when an operation is attempted on a quarantined agent."""
    pass


class DatabaseConnectionException(ArtsaException):
    """Raised when database operations fail."""
    pass
