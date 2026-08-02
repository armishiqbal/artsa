"""Dynamic LLM Provider Registry for ARTSA — Enables plug-and-play AI backends."""

from __future__ import annotations

import logging
import os
from typing import Any, Callable

from langchain_core.language_models.chat_models import BaseChatModel

logger = logging.getLogger(__name__)


def _chat_openai(**kwargs: Any) -> BaseChatModel:
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(**kwargs)

# Type alias for provider factory functions
ProviderFactory = Callable[
    [str, float, int, str | None, str | None, dict[str, Any]], BaseChatModel
]

# Global Provider Registry
_PROVIDER_REGISTRY: dict[str, ProviderFactory] = {}


def register_provider(name: str):
    """Decorator to register a custom LLM provider factory dynamically.

    Example usage:
        @register_provider("cohere")
        def create_cohere_provider(model, temperature, max_retries, api_key, base_url, **kwargs):
            return ChatCohere(model=model, cohere_api_key=api_key)
    """
    def decorator(fn: ProviderFactory):
        _PROVIDER_REGISTRY[name.lower()] = fn
        logger.debug("Registered custom LLM provider: %s", name.lower())
        return fn
    return decorator


def get_available_providers() -> list[str]:
    """Return a list of all registered provider names."""
    return sorted(list(_PROVIDER_REGISTRY.keys()))


def create_llm_instance(
    provider: str,
    model: str = "gpt-4o",
    temperature: float = 0.7,
    max_retries: int = 3,
    api_key: str | None = None,
    base_url: str | None = None,
    **kwargs: Any,
) -> BaseChatModel:
    """Dynamically create a LangChain BaseChatModel instance for ANY provider.

    Supports registered factories, known OpenAI-compatible APIs, local servers,
    and dynamic endpoint discovery.
    """
    prov_clean = provider.lower().strip()

    # 1. Check registered custom provider factory
    if prov_clean in _PROVIDER_REGISTRY:
        return _PROVIDER_REGISTRY[prov_clean](
            model, temperature, max_retries, api_key, base_url, kwargs
        )

    # 2. Known standard cloud/local providers mapped via OpenAI protocol
    known_endpoints: dict[str, tuple[str, str, str]] = {
        # provider: (default_base_url, env_key_name, default_model)
        "groq": ("https://api.groq.com/openai/v1", "GROQ_API_KEY", "llama-3.3-70b-versatile"),
        "mistral": ("https://api.mistral.ai/v1", "MISTRAL_API_KEY", "open-mistral-7b"),
        "deepseek": ("https://api.deepseek.com/v1", "DEEPSEEK_API_KEY", "deepseek-chat"),
        "openrouter": ("https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", "auto"),
        "together": ("https://api.together.xyz/v1", "TOGETHER_API_KEY", "meta-llama/Llama-3.3-70B-Instruct-Turbo"),
        "fireworks": ("https://api.fireworks.ai/inference/v1", "FIREWORKS_API_KEY", "accounts/fireworks/models/llama-v3p3-70b-instruct"),
        "huggingface": ("https://api-inference.huggingface.co/v1", "HF_TOKEN", "meta-llama/Meta-Llama-3-8B-Instruct"),
        "ollama": ("http://localhost:11434/v1", "OLLAMA_API_KEY", "llama3.2"),
        "vllm": ("http://localhost:8000/v1", "VLLM_API_KEY", "default"),
        "lmstudio": ("http://localhost:1234/v1", "LMSTUDIO_API_KEY", "local-model"),
        "jan": ("http://localhost:1337/v1", "JAN_API_KEY", "local-model"),
        "local": ("http://localhost:8000/v1", "LOCAL_API_KEY", "default"),
    }

    if prov_clean in known_endpoints:
        default_url, env_var, default_m = known_endpoints[prov_clean]
        resolved_url = base_url or os.environ.get(f"{prov_clean.upper()}_BASE_URL") or default_url
        resolved_key = api_key or os.environ.get(env_var) or os.environ.get(f"{prov_clean.upper()}_API_KEY") or "mock-key"
        resolved_model = model if model not in ("gpt-4o", "gpt-5.6-terra", "", "default") else default_m

        return _chat_openai(
            model=resolved_model,
            temperature=temperature,
            max_retries=max_retries,
            api_key=resolved_key,
            base_url=resolved_url,
            **kwargs,
        )

    # 3. Dynamic Universal OpenAI-Compatible Discovery
    # If the user specifies any new/unknown provider (e.g. "my_new_provider"), check env vars or base_url
    env_url = os.environ.get(f"{prov_clean.upper()}_BASE_URL")
    env_key = os.environ.get(f"{prov_clean.upper()}_API_KEY")
    resolved_url = base_url or env_url
    resolved_key = api_key or env_key or "mock-key"

    if resolved_url:
        logger.info(
            "Dynamically connecting to custom provider '%s' at base_url: %s",
            provider,
            resolved_url,
        )
        return _chat_openai(
            model=model,
            temperature=temperature,
            max_retries=max_retries,
            api_key=resolved_key,
            base_url=resolved_url,
            **kwargs,
        )

    # 4. Standard OpenAI Default
    logger.info("Initializing OpenAI provider for '%s'", provider)
    resolved_key = api_key or os.environ.get("OPENAI_API_KEY") or "mock-key-for-testing"
    return _chat_openai(
        model=model,
        temperature=temperature,
        max_retries=max_retries,
        request_timeout=60,
        api_key=resolved_key,
        **kwargs,
    )
