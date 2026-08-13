"""Catalog of every LLM API ARTSA can talk to out of the box.

Used by:
- ``GET /providers/catalog`` — the "all options" surface for users;
- the containment proxy / test endpoint fallbacks when a registered
  provider has no custom ``base_url``.

Users are not limited to this list: any OpenAI-compatible endpoint can be
registered with a custom ``base_url`` (e.g. a private gateway).
"""

from __future__ import annotations

# name -> {base_url, env_key, default_model, description}
PROVIDER_CATALOG: dict[str, dict[str, str | None]] = {
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "env_key": "OPENAI_API_KEY",
        "default_model": "gpt-4o",
        "description": "OpenAI GPT-4o / o-series",
    },
    "anthropic": {
        "base_url": "https://api.anthropic.com/v1",
        "env_key": "ANTHROPIC_API_KEY",
        "default_model": "claude-3-5-sonnet",
        "description": "Anthropic Claude (native + translated)",
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "env_key": "GROQ_API_KEY",
        "default_model": "llama-3.3-70b-versatile",
        "description": "Groq — fast open models",
    },
    "mistral": {
        "base_url": "https://api.mistral.ai/v1",
        "env_key": "MISTRAL_API_KEY",
        "default_model": "open-mistral-7b",
        "description": "Mistral AI",
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "env_key": "DEEPSEEK_API_KEY",
        "default_model": "deepseek-v4-flash",
        "description": "DeepSeek v4 flash / pro",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "env_key": "OPENROUTER_API_KEY",
        "default_model": "auto",
        "description": "OpenRouter — 200+ models",
    },
    "together": {
        "base_url": "https://api.together.xyz/v1",
        "env_key": "TOGETHER_API_KEY",
        "default_model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        "description": "Together AI",
    },
    "fireworks": {
        "base_url": "https://api.fireworks.ai/inference/v1",
        "env_key": "FIREWORKS_API_KEY",
        "default_model": "accounts/fireworks/models/llama-v3p3-70b-instruct",
        "description": "Fireworks AI",
    },
    "huggingface": {
        "base_url": "https://api-inference.huggingface.co/v1",
        "env_key": "HF_TOKEN",
        "default_model": "meta-llama/Meta-Llama-3-8B-Instruct",
        "description": "Hugging Face Inference API",
    },
    "ollama": {
        "base_url": "http://localhost:11434/v1",
        "env_key": "OLLAMA_API_KEY",
        "default_model": "llama3.2",
        "description": "Ollama — local models",
    },
    "vllm": {
        "base_url": "http://localhost:8000/v1",
        "env_key": "VLLM_API_KEY",
        "default_model": "default",
        "description": "vLLM local server",
    },
    "lmstudio": {
        "base_url": "http://localhost:1234/v1",
        "env_key": "LMSTUDIO_API_KEY",
        "default_model": "local-model",
        "description": "LM Studio local server",
    },
    "jan": {
        "base_url": "http://localhost:1337/v1",
        "env_key": "JAN_API_KEY",
        "default_model": "local-model",
        "description": "Jan local server",
    },
    "local": {
        "base_url": None,
        "env_key": "LOCAL_API_KEY",
        "default_model": "default",
        "description": "Custom local OpenAI-compatible endpoint",
    },
}


def catalog_base_url(provider_type: str) -> str | None:
    """Default base URL for a known provider type (None for unknown/custom)."""
    return (PROVIDER_CATALOG.get(provider_type.lower()) or {}).get("base_url")


def catalog_default_model(provider_type: str) -> str | None:
    return (PROVIDER_CATALOG.get(provider_type.lower()) or {}).get("default_model")
