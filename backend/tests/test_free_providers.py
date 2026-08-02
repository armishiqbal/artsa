"""Tests for dynamic LLM provider registry and free/open-weight model providers."""

import os
import pytest
from src.agents.base_agent import BaseAgent
from src.agents.target_agent import TargetAgent
from src.agents.provider_registry import (
    create_llm_instance,
    register_provider,
    get_available_providers,
)
from src.models import TargetConfig


def _get_chat_openai():
    from langchain_openai import ChatOpenAI
    return ChatOpenAI


class DummyAgent(BaseAgent):
    """Concrete BaseAgent subclass for provider testing."""
    pass


def test_groq_provider_init():
    agent = DummyAgent(
        name="GroqTester",
        provider="groq",
        model="llama-3.3-70b-versatile",
        api_key="gsk_test123",
    )
    assert agent.provider == "groq"
    assert agent.model == "llama-3.3-70b-versatile"
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
