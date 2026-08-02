# LLM Provider Matrix

ARTSA supports plug-and-play LLM backends via `src/agents/provider_registry.py`.

## Built-in Providers (OpenAI-compatible)

| Provider | Base URL | Env Key | Default Model |
|----------|----------|---------|---------------|
| openai | api.openai.com | OPENAI_API_KEY | gpt-4o |
| groq | api.groq.com/openai/v1 | GROQ_API_KEY | llama-3.3-70b-versatile |
| mistral | api.mistral.ai/v1 | MISTRAL_API_KEY | open-mistral-7b |
| deepseek | api.deepseek.com/v1 | DEEPSEEK_API_KEY | deepseek-chat |
| openrouter | openrouter.ai/api/v1 | OPENROUTER_API_KEY | auto |
| together | api.together.xyz/v1 | TOGETHER_API_KEY | Llama-3.3-70B |
| fireworks | api.fireworks.ai/inference/v1 | FIREWORKS_API_KEY | llama-v3p3-70b |
| huggingface | api-inference.huggingface.co/v1 | HF_TOKEN | Meta-Llama-3-8B |
| ollama | localhost:11434/v1 | OLLAMA_API_KEY | llama3.2 |
| vllm | localhost:8000/v1 | VLLM_API_KEY | default |
| lmstudio | localhost:1234/v1 | LMSTUDIO_API_KEY | local-model |
| jan | localhost:1337/v1 | JAN_API_KEY | local-model |
| local | localhost:8000/v1 | LOCAL_API_KEY | default |

## Custom Providers

Set `{PROVIDER}_BASE_URL` and `{PROVIDER}_API_KEY` env vars, or use `@register_provider` decorator.

## Embedding Models

| Model | Dimensions | Use Case |
|-------|------------|----------|
| hash-1024 | 1024 | Offline/test semantic detection |
| text-embedding-3-large | 1024 | Production OpenAI embeddings |
| nomic-embed-text-v1.5 | 768 | Local Ollama embeddings |

## Tests

Run provider registry tests:

```bash
cd backend && pip install -e ".[dev]" && pytest tests/test_free_providers.py -v
```

Tests use lazy `langchain-openai` imports and mock API keys — no live API calls required for init tests.
