"""FastAPI Dependency Injection Providers."""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from src.data.db import get_async_db
from src.services.event_processor import EventProcessor
from src.services.session_tracker import SessionTracker

_processor = EventProcessor()
_tracker = SessionTracker()


def get_event_processor() -> EventProcessor:
    """Dependency provider for EventProcessor service."""
    return _processor


def get_session_tracker() -> SessionTracker:
    """Dependency provider for SessionTracker service."""
    return _tracker
