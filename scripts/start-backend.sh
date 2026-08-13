#!/usr/bin/env bash
# Start the ARTSA backend with a clean provider environment.
#
# Background: this machine's shell profile exports stale/empty LLM provider
# variables (OPENAI_API_KEY, ANTHROPIC_API_KEY, ARTSA_DEFAULT_MODEL, ...).
# pydantic-settings gives environment variables precedence over .env, so those
# stale values silently override the repo .env. This wrapper unsets them all,
# making the repo .env (DeepSeek-only) the single source of truth.
#
# Usage: bash scripts/start-backend.sh [extra uvicorn args...]

set -euo pipefail
cd "$(dirname "$0")/../backend"

# Every provider-related variable that may be polluted in the parent shell.
UNSET_VARS=(
  DEEPSEEK_API_KEY OPENAI_API_KEY OPENAI_BASE_URL ANTHROPIC_API_KEY
  ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL ANTHROPIC_DEFAULT_HAIKU_MODEL
  ANTHROPIC_DEFAULT_OPUS_MODEL ANTHROPIC_DEFAULT_SONNET_MODEL ANTHROPIC_MODEL
  GROQ_API_KEY MISTRAL_API_KEY HUGGINGFACE_API_KEY HF_TOKEN
  OLLAMA_API_KEY OLLAMA_BASE_URL VLLM_API_KEY VLLM_BASE_URL
  LMSTUDIO_API_KEY LMSTUDIO_BASE_URL JAN_API_KEY JAN_BASE_URL
  LOCAL_API_KEY LOCAL_BASE_URL OPENROUTER_API_KEY TOGETHER_API_KEY
  FIREWORKS_API_KEY COHERE_API_KEY GOOGLE_API_KEY
  LAKERA_API_KEY LAKERA_BASE_URL AZURE_CONTENT_SAFETY_KEY
  AZURE_CONTENT_SAFETY_ENDPOINT NVIDIA_API_KEY NEMO_GUARDRAILS_URL
  ARTSA_API_KEY ARTSA_DATA_DIR ARTSA_DEFAULT_MODEL ARTSA_DEFAULT_PROVIDER
  ARTSA_EMBEDDING_MODEL ARTSA_LOG_LEVEL ARTSA_TENANT_ID DEEPSEEK_DOCS_URL
)

env_args=()
for var in "${UNSET_VARS[@]}"; do
  env_args+=(-u "$var")
done

PYTHONPATH=. exec env "${env_args[@]}" .venv/bin/python -m uvicorn src.api.main:app --port 8000 "$@"
