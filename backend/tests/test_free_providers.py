"""Tests for dynamic LLM provider registry and free/open-weight model providers."""

from src.agents.base_agent import BaseAgent
from src.services.provider_registry import (
    get_available_providers,
    register_provider,
)


def _get_chat_openai():
    from langchain_openai import ChatOpenAI
    return ChatOpenAI


class DummyAgent(BaseAgent):
    """Concrete BaseAgent subclass for provider testing."""


def test_groq_provider_init():
    agent = DummyAgent(
        name="GroqTester",
        provider="groq",
        model="openai/gpt-oss-120b",
        api_key="gsk_test123",
    )
    assert agent.provider == "groq"
    assert agent.model == "openai/gpt-oss-120b"
    assert "groq.com" in str(agent.llm.openai_api_base)


def test_mistral_provider_init():
    agent = DummyAgent(
        name="MistralTester",
        provider="mistral",
        model="open-mistral-7b",
        api_key="mistral_test123",
    )
    assert agent.provider == "mistral"
    assert agent.model == "open-mistral-7b"
    assert "mistral.ai" in str(agent.llm.openai_api_base)


def test_deepseek_provider_init():
    agent = DummyAgent(
        name="DeepSeekTester",
        provider="deepseek",
        model="deepseek-chat",
        api_key="sk-deepseek-test",
    )
    assert agent.provider == "deepseek"
    assert "deepseek.com" in str(agent.llm.openai_api_base)


def test_openrouter_provider_init():
    agent = DummyAgent(
        name="OpenRouterTester",
        provider="openrouter",
        model="openrouter/free",
        api_key="sk-or-test",
    )
    assert agent.provider == "openrouter"
    assert "openrouter.ai" in str(agent.llm.openai_api_base)


def test_ollama_provider_init():
    agent = DummyAgent(
        name="OllamaTester",
        provider="ollama",
        model="llama3.2",
    )
    assert agent.provider == "ollama"
    assert "localhost:11434" in str(agent.llm.openai_api_base)


def test_dynamic_unknown_provider_with_base_url():
    agent = DummyAgent(
        name="DynamicTester",
        provider="any_custom_new_inference_backend",
        model="custom-v1",
        base_url="https://my-private-llm.company.org/v1",
        api_key="secret-key",
    )
    assert agent.provider == "any_custom_new_inference_backend"
    assert "my-private-llm.company.org" in str(agent.llm.openai_api_base)


def test_custom_decorator_registration():
    @register_provider("mock_custom_engine")
    def custom_builder(model, temperature, max_retries, api_key, base_url, extra):
        ChatOpenAI = _get_chat_openai()
        return ChatOpenAI(
            model="custom-decorated-model",
            temperature=temperature,
            api_key="decorated-key",
            base_url="http://decorated-endpoint/v1",
        )

    assert "mock_custom_engine" in get_available_providers()
    agent = DummyAgent(
        name="DecoratorTester",
        provider="mock_custom_engine",
    )
    assert agent.llm.model_name == "custom-decorated-model"
    assert "decorated-endpoint" in str(agent.llm.openai_api_base)


def test_legacy_agent_registry_path_is_a_re_export():
    """The old src.agents.provider_registry import path still resolves to the
    same objects in src.services.provider_registry (backward-compat shim)."""
    import src.agents.provider_registry as legacy
    import src.services.provider_registry as current

    assert legacy.create_llm_instance is current.create_llm_instance
    assert legacy.get_available_providers is current.get_available_providers
    assert legacy.register_provider is current.register_provider
