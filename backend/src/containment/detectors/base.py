"""Base Detector Abstract Class."""

from abc import ABC, abstractmethod
from typing import Optional
from src.core.models.events import ToolCallEvent, SecurityEvent


class BaseDetector(ABC):
    """Abstract base class for all containment risk detectors."""

    def __init__(self, name: str) -> None:
        self.name = name

    @abstractmethod
    def detect(self, event: ToolCallEvent) -> Optional[SecurityEvent]:
        """Inspect a tool call event and return a SecurityEvent if risk detected."""
        pass
