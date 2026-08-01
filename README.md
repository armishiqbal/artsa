# 🛡️ ARTSA — Real-Time AI Agent Containment Platform

> **"Datadog for AI Agent Escape Detection & Live Containment Monitoring."**

[![Python Version](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111.0-009688.svg)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-000000.svg)](https://nextjs.org)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![CI Status](https://img.shields.io/badge/CI%2FCD-Passing-emerald.svg)](.github/workflows/ci.yml)

---

## 📌 Executive Summary

**ARTSA** (Adversarial Red Team Simulation Architecture) is an enterprise-grade **Real-Time AI Agent Containment & Escape Detection Platform**. It operates directly in front of or inside autonomous AI agent execution loops to inspect tool calls in sub-50ms, detect malicious prompts and containment breaches, and automatically enforce quarantine actions before harm occurs.

| Core Engine | Function & Performance Target |
|-------------|--------------------------------|
| 🔌 **Escape Detection Engine (EDS)** | Real-time tool execution risk scoring (<50ms latency target) |
| 🗄️ **Supabase PostgreSQL & Pinecone** | Managed persistence & 1024-dim vector embeddings |
| 🎨 **2026 Bento SOC War Room** | Next.js 14 Command Center with 1-click Autopsy Replay Mode |
| 📊 **Multi-Model Asymmetry Testing** | Side-by-side Commercial (GPT-5.6 / Opus 5) vs Open Attacker evaluation |

---

## 🌟 Key Product Capabilities

### 1. Escape Detection as a Service (EDS)
- Intercepts tool calls (`exec_command`, `file_read`, `network_egress`) in **sub-50ms**.
- Composite scoring across **Rule-Based**, **Statistical Frequency**, **Semantic Prompt Injection**, and **Goal Drift** detectors.
- Recommended actions: `NONE`, `ALERT`, `THROTTLE`, `KILL`, `QUARANTINE`.

### 2. Live Telemetry & Redis Streams
- Dual Redis Stream (`events:incoming`) and Celery worker pipeline for high-throughput execution processing.
- Live WebSocket stream endpoint (`/v1/sessions/{session_id}/stream`) feeding real-time war room widgets.

### 3. 2026 Bento Grid SOC War Room
- Dynamic dark-mode dashboard (`bg-[#0B0F19]`) with selective glassmorphism.
- Integrated **Cmd+K Command Palette**, **Defense Depth Meter**, and **Autopsy Replay Modal**.

### 4. Regulatory Audit Exporter
- Automated export for **EU AI Act Article 15 (Cybersecurity & Robustness)** and **NIST AI RMF 1.0 (GOVERN 1.2 & MEASURE 2.6)** compliance.

---

## 🏗️ Monorepo Architecture

```
artsa/
├── pyproject.toml                     # Root dependencies & pytest config
├── package.json                       # Monorepo script runner
├── docker-compose.yml                 # Postgres 16, Redis 7, Backend API, Frontend
├── Makefile                           # Development automation commands
├── .env.example                       # Shared environment configuration template
│
├── backend/                           # Fast-API Engine & Data Services
│   ├── src/
│   │   ├── api/                       # REST & WebSocket Endpoints (health, ingest, sessions, agents, alerts)
│   │   ├── core/                      # Pydantic v2 Models (events, sessions, agents, scores, alerts)
│   │   ├── containment/               # EDS Containment Engine, Detectors & Composite Scorer
│   │   ├── data/                      # Async SQLAlchemy 2.0 Engine & Repositories
│   │   ├── services/                  # EventProcessor, SessionTracker, ScoringService
│   │   └── workers/                   # Celery worker tasks & Redis stream consumers
│   └── tests/                         # Unit, Integration, and E2E Test Suite
│
├── frontend/                          # Next.js 14 Command Center War Room
│   ├── app/                           # App Router pages (Command Center, Topology, Replay, X-Ray)
│   ├── components/                    # Bento War Room Grid, Severity Badges, Risk Score meters
│   └── lib/                           # TypeScript interfaces matching backend models
│
├── sdk/                               # Agent Instrumentation SDK
│   └── python/                        # artsa-sdk client & LangChain tool interceptor
│
└── infra/                             # Docker, Kubernetes & Deployment configurations
```

---

## ⚡ Quick Start Guide

### Prerequisites
- **Python**: 3.11+
- **Node.js**: 20+
- **Docker & Docker Compose** (Optional for containerized run)

### 1. Launch with Docker Compose (Recommended)
```bash
docker-compose up -d --build
```
- 🌐 **Backend API**: `http://localhost:8000/v1/health`
- 🎨 **Next.js Dashboard**: `http://localhost:3000`
- 🗄️ **PostgreSQL**: `localhost:5432`
- 🔴 **Redis**: `localhost:6379`

### 2. Local Development (Single Command)
```bash
# Install root dependencies
npm install

# Start Backend (Port 8000) and Frontend (Port 3000) concurrently:
npm run dev
```

### 3. Running Backend Tests
```bash
make test
# OR manually:
cd backend && python -m pytest tests/ -v
```

---

## 🔌 Python SDK Usage

Install the `artsa-sdk` to instrument any LLM agent tool call loop:

```python
from artsa import ArtsaClient
from artsa.middleware.langchain import LangChainContainmentCallback

client = ArtsaClient(api_url="http://localhost:8000")

# Instrument LangChain Agent
callback = LangChainContainmentCallback(
    client=client,
    session_id="session-123",
    agent_id="support-agent-01"
)
```

---

## ⚖️ License & Compliance

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
