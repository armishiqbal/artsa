"""Base repository with shared CRUD helpers."""

from __future__ import annotations

from typing import Generic, Sequence, TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class BaseRepository(Generic[T]):
    """Generic async repository base class."""

    def __init__(self, session: AsyncSession, model_class: type[T]) -> None:
        self.session = session
        self.model_class = model_class

    async def bulk_create(self, rows: Sequence[T]) -> None:
        for row in rows:
            self.session.add(row)
