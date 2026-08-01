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

COPY pyproject.toml .
COPY backend/ ./backend/

RUN pip install --upgrade pip && \
    pip install -e "./backend"

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "backend.src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
