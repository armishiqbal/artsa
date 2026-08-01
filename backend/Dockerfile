# =============================================================================
# ARTSA — Multi-stage Dockerfile
# =============================================================================

FROM python:3.11-slim AS base

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

# ─── Build Stage ─────────────────────────────────────────────────
FROM base AS builder

COPY pyproject.toml ./
COPY src/ src/

RUN pip install --no-cache-dir --prefix=/install .

# ─── Runtime Stage ───────────────────────────────────────────────
FROM base AS runtime

COPY --from=builder /install /usr/local

COPY . .

# Default environment
ENV ARTSA_LOG_LEVEL=INFO \
    ARTSA_DATA_DIR=/app/data

# Create data directory
RUN mkdir -p /app/data/results /app/data/chroma

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
    CMD python -c "from src.models import CampaignConfig; print('OK')" || exit 1

ENTRYPOINT ["python", "scripts/run_campaign.py"]
CMD ["--rounds", "20"]
