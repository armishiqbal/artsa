"""Configuration & API key status endpoints (values never exposed)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from src.core.auth_credentials import (
    extract_bearer_token,
    resolve_auth_method,
    resolve_credentials,
)
from src.core.config import settings
from src.core.password_auth import decode_session_token, password_auth_enabled
from src.core.rbac import Role, role_capabilities
from src.core.secrets import key_status, mask_secret

router = APIRouter(tags=["Configuration"])

# Registry of all supported keys with metadata for UI / ops
KEY_REGISTRY: list[dict[str, str]] = [
    # LLM providers
    {"id": "OPENAI_API_KEY", "label": "OpenAI", "category": "llm", "required_for": "Wargame judge & GPT targets"},
    {"id": "ANTHROPIC_API_KEY", "label": "Anthropic", "category": "llm", "required_for": "Claude targets"},
    {"id": "GROQ_API_KEY", "label": "Groq", "category": "llm", "required_for": "Free fast inference"},
    {"id": "MISTRAL_API_KEY", "label": "Mistral", "category": "llm", "required_for": "Mistral models"},
    {"id": "DEEPSEEK_API_KEY", "label": "DeepSeek", "category": "llm", "required_for": "DeepSeek R1/V3"},
    {"id": "OPENROUTER_API_KEY", "label": "OpenRouter", "category": "llm", "required_for": "Multi-model routing"},
    {"id": "TOGETHER_API_KEY", "label": "Together AI", "category": "llm", "required_for": "Together inference"},
    {"id": "FIREWORKS_API_KEY", "label": "Fireworks", "category": "llm", "required_for": "Fireworks models"},
    {"id": "HUGGINGFACE_API_KEY", "label": "Hugging Face", "category": "llm", "required_for": "HF serverless"},
    {"id": "HF_TOKEN", "label": "HF Token", "category": "llm", "required_for": "HF alternative token"},
    {"id": "COHERE_API_KEY", "label": "Cohere", "category": "llm", "required_for": "Cohere models"},
    {"id": "GOOGLE_API_KEY", "label": "Google AI", "category": "llm", "required_for": "Gemini models"},
    # Guardrails
    {"id": "LAKERA_API_KEY", "label": "Lakera Guard", "category": "guardrail", "required_for": "Live prompt injection detection"},
    {"id": "AZURE_CONTENT_SAFETY_KEY", "label": "Azure Content Safety", "category": "guardrail", "required_for": "Output toxicity filter"},
    {"id": "NVIDIA_API_KEY", "label": "NVIDIA NIM", "category": "guardrail", "required_for": "NeMo guardrails (optional)"},
    # Infrastructure
    {"id": "DATABASE_URL", "label": "Database URL", "category": "infra", "required_for": "Session persistence"},
    {"id": "REDIS_URL", "label": "Redis", "category": "infra", "required_for": "Event streaming (optional)"},
    {"id": "PINECONE_API_KEY", "label": "Pinecone", "category": "infra", "required_for": "Vector RAG store"},
    {"id": "SUPABASE_URL", "label": "Supabase", "category": "infra", "required_for": "Managed Postgres"},
    {"id": "SECRET_KEY", "label": "App Secret", "category": "security", "required_for": "JWT / signing"},
    {"id": "ARTSA_API_KEY", "label": "ARTSA API Key", "category": "security", "required_for": "API authentication"},
]


def _build_key_entry(entry: dict[str, str]) -> dict[str, Any]:
    key_id = entry["id"]
    raw = getattr(settings, key_id, None)
    status = key_status(str(raw) if raw else None)
    return {
        **entry,
        "status": status,
        "configured": status == "configured",
        "preview": mask_secret(str(raw) if raw else None),
    }


@router.get("/config/me")
async def get_current_identity(request: Request) -> dict[str, Any]:
    """Return resolved role and capabilities for the current credentials (no secrets)."""
    api_key: str | None = request.headers.get("X-API-Key")
    bearer = extract_bearer_token(request.headers.get("Authorization"))
    role = resolve_credentials(api_key, bearer)

    if role is None and (settings.auth_required or settings.ARTSA_OIDC_ENABLED):
        return {
            "authenticated": False,
            "role": None,
            "capabilities": {},
            "auth_method": None,
            "auth_required": settings.auth_required,
            "oidc_enabled": settings.ARTSA_OIDC_ENABLED,
            "password_auth_enabled": password_auth_enabled(),
            "user": None,
        }

    effective_role = role or Role.ADMIN

    # Only password sessions carry an ARTSA user profile; API keys and OIDC
    # JWTs don't map to a local account, so expose the profile just for those.
    auth_method = resolve_auth_method(api_key, bearer)
    user: dict[str, Any] | None = None
    if auth_method == "password":
        claims = decode_session_token(bearer) or {}
        user = {
            "email": claims.get("email"),
            "role": claims.get("role"),
            "display_name": claims.get("display_name"),
            "avatar": claims.get("avatar"),
        }

    return {
        "authenticated": role is not None or not settings.auth_required,
        "role": effective_role.value,
        "capabilities": role_capabilities(effective_role),
        "auth_required": settings.auth_required,
        "auth_method": auth_method,
        "oidc_enabled": settings.ARTSA_OIDC_ENABLED,
        "password_auth_enabled": password_auth_enabled(),
        "user": user,
    }


@router.get("/config/keys")
async def get_key_status() -> dict[str, Any]:
    """Return configuration status for all registered keys (no raw secrets)."""
    keys = [_build_key_entry(e) for e in KEY_REGISTRY]
    by_category: dict[str, list[dict[str, Any]]] = {}
    for k in keys:
        by_category.setdefault(k["category"], []).append(k)

    llm_configured = sum(1 for k in keys if k["category"] == "llm" and k["configured"])
    guardrail_configured = sum(1 for k in keys if k["category"] == "guardrail" and k["configured"])

    return {
        "environment": settings.ENVIRONMENT,
        "use_sqlite": settings.USE_SQLITE,
        "default_provider": settings.ARTSA_DEFAULT_PROVIDER,
        "default_model": settings.ARTSA_DEFAULT_MODEL,
        "tenant_id": settings.ARTSA_TENANT_ID,
        "summary": {
            "llm_providers_configured": llm_configured,
            "guardrails_configured": guardrail_configured,
            "total_configured": sum(1 for k in keys if k["configured"]),
            "total_keys": len(keys),
        },
        "keys": keys,
        "by_category": by_category,
    }


@router.get("/config/providers")
async def get_provider_readiness() -> dict[str, Any]:
    """Return LLM provider readiness based on configured keys."""
    from src.services.provider_registry import get_available_providers

    providers = [
        {"id": "openai", "name": "OpenAI", "type": "cloud_api", "model": settings.ARTSA_DEFAULT_MODEL, "configured": settings.is_key_configured("OPENAI_API_KEY")},
        {"id": "groq", "name": "Groq", "type": "cloud_free", "model": "openai/gpt-oss-120b", "configured": settings.is_key_configured("GROQ_API_KEY")},
        {"id": "mistral", "name": "Mistral", "type": "cloud_api", "model": "open-mistral-7b", "configured": settings.is_key_configured("MISTRAL_API_KEY")},
        {"id": "deepseek", "name": "DeepSeek", "type": "cloud_api", "model": "deepseek-chat", "configured": settings.is_key_configured("DEEPSEEK_API_KEY")},
        {"id": "anthropic", "name": "Anthropic", "type": "cloud_api", "model": "claude-3-5-sonnet", "configured": settings.is_key_configured("ANTHROPIC_API_KEY")},
        {"id": "openrouter", "name": "OpenRouter", "type": "cloud_api", "model": "auto", "configured": settings.is_key_configured("OPENROUTER_API_KEY")},
        {"id": "ollama", "name": "Ollama Local", "type": "local", "model": "llama3.2", "configured": True},
        {"id": "huggingface", "name": "Hugging Face", "type": "cloud_free", "model": "meta-llama/Meta-Llama-3-8B-Instruct", "configured": settings.is_key_configured("HUGGINGFACE_API_KEY") or settings.is_key_configured("HF_TOKEN")},
    ]

    return {
        "providers": providers,
        "registered": get_available_providers(),
        "guardrails": {
            "lakera": settings.is_key_configured("LAKERA_API_KEY"),
            "azure_content_safety": settings.is_key_configured("AZURE_CONTENT_SAFETY_KEY"),
            "heuristic": True,
        },
        "api_gateway": {
            "status": "fully_connected",
            "mode": "unified",
            "message": "Wargame, attack library, and containment share the main API on port 8000.",
        },
    }
