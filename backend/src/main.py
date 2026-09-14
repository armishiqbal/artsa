"""ARTSA Main Application Module — re-exports app from src.api.main."""

from src.api.main import app, create_app
from src.api.routes.github_webhooks import router as github_webhooks_router

__all__ = ["app", "create_app", "github_webhooks_router"]
