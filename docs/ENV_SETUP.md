# Environment & API Key Setup

## Quick start

```bash
cp .env.example .env
npm run setup:env
npm run dev
curl http://localhost:8000/api/v1/config/keys
```

See `/providers` in the dashboard for a visual key status table.

## Security

- Never commit `.env`
- Never put API keys in `NEXT_PUBLIC_*` variables
- Backend-only: Pinecone, OpenAI, Lakera, Azure keys

## Key groups

| Group | Variables |
|-------|-----------|
| LLM | `OPENAI_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, … |
| Guardrails | `LAKERA_API_KEY`, `AZURE_CONTENT_SAFETY_KEY` |
| Infra | `DATABASE_URL`, `PINECONE_API_KEY`, `SUPABASE_*` |
