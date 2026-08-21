# External Guardrail Comparison (Lakera / Azure)

Run ARTSA against Lakera Guard and Azure AI Content Safety on the **same** independent-set samples.

## When you have API keys

Add to `backend/.env` (never commit secrets):

```bash
LAKERA_API_KEY=your_lakera_key
AZURE_CS_ENDPOINT=https://<resource>.cognitiveservices.azure.com
AZURE_CS_KEY=your_azure_content_safety_key
```

Then from `backend/`:

```bash
ARTSA_EMBEDDING_MODEL=local-bge-multilingual ENVIRONMENT=testing \
  PYTHONPATH=. python scripts/external_comparison.py
```

Output: `docs/COMPARISON.md` with recall/FPR per provider.

## Without keys

The script still writes ARTSA's honest numbers and marks Lakera/Azure columns **n/a**. No fabricated competitor scores.

## Optional limits

```bash
PYTHONPATH=. python scripts/external_comparison.py --limit 50
```

Default cap is 200 samples (API budget guard).
