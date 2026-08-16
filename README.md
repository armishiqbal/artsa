# 🛡️ ARTSA — Real-Time Security & Safety Guardrail for AI Agents

> **"The automatic safety airbag for AI agents in your business."**

---

## 💡 What is ARTSA? (In Simple Terms)

Today, businesses use **AI Agents** — smart digital assistants powered by AI that can automatically read files, answer customer emails, search databases, and run computer commands.

However, just like human employees, **AI agents can make mistakes or be tricked by hackers** (known as *Prompt Injections* or *Jailbreaks*). If an AI agent gets tricked, it might accidentally leak company passwords, delete important files, or send private customer data to the wrong person.

**ARTSA acts like an automatic security guardrail and airbag for your AI agents.** It watches everything the AI agent tries to do in real-time (in less than 0.05 seconds) and instantly **stops the AI before any damage can happen.**

---

## ❓ The Problem ARTSA Solves

| The Risk | What Could Go Wrong? | How ARTSA Protects You |
|----------|----------------------|------------------------|
| 🔓 **AI Getting Tricked** | A sneaky user asks the AI to ignore its rules and reveal secret passwords. | **ARTSA blocks the trick question before the AI responds.** |
| 💥 **Accidental File Deletion** | The AI misinterprets a command and tries to delete server files. | **ARTSA freezes the command in 0.05 seconds.** |
| 📤 **Data Leakage** | The AI attempts to send private customer records to an unknown website. | **ARTSA cuts off the AI's internet connection immediately.** |
| 🌀 **AI Going Off-Track** | The AI wanders off its original goal and starts doing random unauthorized tasks. | **ARTSA flags the unusual behavior and alerts your team.** |

---

## ⚡ How ARTSA Works in 3 Easy Steps

```
1. AI Tries to Act          2. ARTSA Inspects (<0.05s)          3. Safe Result Enforced
 ┌──────────────┐             ┌─────────────────────┐             ┌────────────────────┐
 │  AI Agent    │  ───────►   │ 🛡️ ARTSA Guardrail │  ───────►   │ ✅ ALLOW (Safe)    │
 │  Wants to:   │             │   Checks Risk:      │             │ ⚠️ ALERT (Review)  │
 │  "Read File" │             │   Rule + AI Scanners│             │ 🛑 BLOCK (Quarantine)
 └──────────────┘             └─────────────────────┘             └────────────────────┘
```

1. **Continuous Inspection**: Every time your AI agent clicks a button, reads a document, or runs a command, ARTSA checks it instantly.
2. **Instant Risk Score (0 to 100)**: ARTSA assigns a risk score to the action.
   - **0 - 49 (Green)**: Safe! The AI is allowed to proceed.
   - **50 - 79 (Yellow)**: Suspicious! The action is flagged for review.
   - **80 - 100 (Red)**: Danger! The containment engine **automatically KILLs** the action and alerts your security team.

   > Thresholds match the config: verdict bands are `>= 80` KILL, `>= 50`
   > QUARANTINE, else SAFE (`backend/src/core/severity.py`). The **LLM proxy**
   > layer (`ARTSA_PROXY_BLOCK_THRESHOLD=60`) is deliberately stricter: it
   > blocks/sanitizes every prompt at `>= 60` (SUSPICIOUS and above) before the
   > request reaches the model, so a borderline prompt never reaches an LLM.
   > The containment engine, not the proxy, applies the 80-100 KILL band.
3. **Visual Dashboard**: Your team gets a live "War Room" dashboard showing all active AI agents, their safety health, and any blocked threats.

---

## 🎨 The Live Security Command Center

ARTSA includes a visual **SOC War Room Dashboard** that anyone can understand:

- 🟢 **Healthy Agents**: AI assistants working safely.
- 🟡 **At-Risk Agents**: AI assistants showing unusual behavior.
- 🔴 **Quarantined Agents**: AI assistants that were stopped because of a security breach.
- 🎬 **1-Click Autopsy Replay**: Rewind and replay any incident step-by-step to see exactly what the AI was doing.

---

## 🚀 Quick Start Guide (Run in 1 Minute)

### Option 1: Run Everything with 1 Command (Docker)
```bash
docker-compose up -d
```
- Open **http://localhost:3000** in your browser to view the Live Security Dashboard!

### Option 2: Local Setup
```bash
# 1. Install dependencies
npm install

# 2. Start both the Security Engine and Dashboard together:
npm run dev
```

> The `dev` script frees port 8000 first, so a stale backend can never shadow
> the current API (no more "everything 404s" surprises).

---

## ⏱️ Protect Your First AI App in 10 Minutes

1. **Start the platform** — `npm run dev`, then open **http://localhost:3000**.
2. **Follow the Get Started wizard** (left sidebar → *Get Started*): connect a
   provider key, run a sample attack, and watch ARTSA block it with a
   plain-language explanation mapped to OWASP LLM Top 10 / MITRE ATLAS.
3. **Drop ARTSA in front of your LLM** — point any OpenAI/Anthropic client at
   the containment proxy; every prompt is scored before it reaches the model:
   ```python
   from openai import OpenAI
   client = OpenAI(base_url="http://localhost:8000/v1/proxy", api_key="...")
   # High-risk prompts are blocked with an OpenAI-style error before forwarding.
   ```
   The proxy is **fail-closed by default** (`ARTSA_PROXY_FAIL_MODE`); its latency
   SLO and fail mode are published at `GET /api/v1/proxy/health`.

   **Liveness/readiness probes:** `GET /health` (alias of `/api/v1/health`) and
   `GET /ready` — usable by external monitors and health checks.
4. **Close the loop** — in the **Attack Sandbox**, any flagged finding offers
   *"Harden against this attack"*: one click turns it into a containment policy
   rule your guardrail enforces in production.
5. **Prove it to auditors** — in **Reports**, export a one-click compliance
   report (Markdown or boardroom-ready PDF) covering OWASP LLM Top 10, NIST AI
   RMF, EU AI Act, and ISO 42001.

For every integration path (HTTP ingest, LangChain, OpenAI tools, MCP, OTEL,
CI), see [docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md).

Config-driven **custom outbound connectors** push alerts and events to *any*
HTTP system — custom method, headers, auth, JSON payload template, and event
triggers — with secrets encrypted at rest, no code required (Settings →
Integrations → Custom Outbound, or `/api/v1/integrations`).

---

## 📄 License & Contact

ARTSA is open-source under the **MIT License**. For questions or enterprise security setup, contact the platform team.

## Secure your AI app

See **[docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md)** for all integration patterns (HTTP ingest, Python SDK, LangChain, OpenAI tools, MCP proxy, OpenTelemetry, CI red team).

Production go-live: **[docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md)** · sample agent: `python examples/production_agent.py`

