FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md .
COPY backend/ ./backend/

# The root pyproject.toml is the single canonical package manifest (the stale
# backend/pyproject.toml was removed). packages.find maps `src` -> backend/src.
RUN pip install --upgrade pip && \
    pip install -e "."

COPY infra/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
# entrypoint.sh cd's to /app/backend and sets PYTHONPATH=/app/backend, so the
# app module is `src.api.main:app` — NOT backend.src.api.main:app.
CMD ["python", "-m", "uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
