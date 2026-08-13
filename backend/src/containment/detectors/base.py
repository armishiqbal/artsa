"""Base Detector Abstract Class."""

from abc import ABC, abstractmethod

from src.core.models.events import SecurityEvent, ToolCallEvent


class BaseDetector(ABC):
    """Abstract base class for all containment risk detectors."""

    def __init__(self, name: str) -> None:
        self.name = name

    @abstractmethod
    def detect(self, event: ToolCallEvent) -> SecurityEvent | None:
        """Inspect a tool call event and return a SecurityEvent if risk detected."""
