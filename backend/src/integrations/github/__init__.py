"""GitHub containment, scoped authentication, and webhook integration."""

from src.integrations.github.auth import (
    DEFAULT_NARROW_PERMISSIONS,
    GitHubAuthManager,
    generate_app_jwt,
    generate_installation_token,
    generate_rsa_key_pair,
)
from src.integrations.github.gateway import (
    GatewayResult,
    GitHubContainmentGateway,
)

__all__ = [
    "DEFAULT_NARROW_PERMISSIONS",
    "GatewayResult",
    "GitHubAuthManager",
    "GitHubContainmentGateway",
    "generate_app_jwt",
    "generate_installation_token",
    "generate_rsa_key_pair",
]
