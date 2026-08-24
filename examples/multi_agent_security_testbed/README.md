# 🛡️ ARTSA Multi-Agent Security Testbed

A complete, runnable **Multi-Agent Tool-Using Chatbot** designed to test and demonstrate **ARTSA's real-time prompt injection containment, tool-call protection, and lateral multi-agent contagion defense**.

---

## 🏗️ Architecture

```
                                  [ User Prompt ]
                                         │
                                         ▼
                             ┌───────────────────────┐
                             │  Agent 1: Triage Bot  │
                             └───────────┬───────────┘
                                         │ Delegates Tasks
                     ┌───────────────────┴───────────────────┐
                     ▼                                       ▼
         ┌───────────────────────┐               ┌───────────────────────┐
         │ Agent 2: Data Worker  │               │ Agent 3: Action Worker│
         │ - query_database()    │               │ - exec_command()      │
         │ - read_document()     │               │ - send_notification() │
         └───────────┬───────────┘               └───────────┬───────────┘
                     │                                       │
                     └───────────────────┬───────────────────┘
                                         │ Inbound Tool Call
                                         ▼
                         ┌───────────────────────────────┐
                         │ 🛡️ ARTSA Containment Gateway  │
                         │     (Evaluated in <50ms)      │
                         └───────────────┬───────────────┘
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
                 ✅ ALLOW (Safe Query)        🛑 BLOCK (Quarantine Attack)
```

---

## 🧪 Included Attack Scenarios

1. **Safe Baseline**: Standard customer order status lookup (`ALLOW`, Risk < 30).
2. **Direct SQL Jailbreak**: System prompt override attempting to dump `admin_passwords` (`QUARANTINE`, Risk 94).
3. **Lateral Multi-Agent Contagion**: Poisoned triage agent triggering an Action Worker reverse shell via `curl | bash` (`QUARANTINE`, Risk 96).
4. **Indirect Document Poisoning**: Document extraction injection exfiltrating data to `hacker@evil.com` (`QUARANTINE`, Risk 92).
5. **Goal Drift Privilege Escalation**: Multi-turn role deception attempting system `/etc/passwd` read (`QUARANTINE`, Risk 88).

---

## ⚡ Quick Start

### 1. Run the Full Automated Simulation
```bash
# Run from repository root:
python examples/multi_agent_security_testbed/run_simulation.py
```

### 2. Run in Interactive Step-by-Step Mode
```bash
python examples/multi_agent_security_testbed/run_simulation.py --interactive
```

---

## 📊 Live Observability in ARTSA War Room

While running the simulation:
1. Open your browser to **[http://localhost:3000](http://localhost:3000)**.
2. Observe:
   - **Real-Time Risk Meters & Severity Breakdown**
   - **Defense Layer Hits** (Rule Inspector, SQL Guard, MCP Execution Guard)
   - **Autopsy Replay Modal (`/replay`)** showing the exact prompt and blocked tool arguments.
