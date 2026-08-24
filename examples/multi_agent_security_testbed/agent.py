"""Multi-Agent Tool-Using Chatbot with ARTSA Containment Guardrail.

Implements a 3-agent cooperative network:
- Agent 1 (Triage / Chatbot): Interacts with user and routes tasks
- Agent 2 (Data Worker): Handles database and file reads
- Agent 3 (Action Worker): Handles command execution and outbound messaging
"""

import time
import uuid
import requests
from typing import Dict, Any, Optional

ARTSA_GATEWAY_URL = "http://localhost:8000"


class ARTSAContainmentGuard:
    """Inline sub-50ms security interceptor for tool calls."""

    def __init__(self, api_url: str = ARTSA_GATEWAY_URL, tenant_id: str = "default_org"):
        self.api_url = api_url.rstrip("/")
        self.tenant_id = tenant_id

    def intercept(
        self,
        session_id: str,
        agent_id: str,
        tool_name: str,
        tool_args: Dict[str, Any],
        context_prompt: str,
        target_agent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send tool call telemetry to ARTSA and return containment decision."""
        start_time = time.perf_counter()
        payload = {
            "event_id": str(uuid.uuid4()),
            "session_id": session_id,
            "agent_id": agent_id,
            "tool_name": tool_name,
            "tool_args": tool_args,
            "context_prompt": context_prompt,
            "tenant_id": self.tenant_id,
            "timestamp": time.time(),
            "target_agent": target_agent_id,
        }

        try:
            res = requests.post(f"{self.api_url}/v1/ingest", json=payload, timeout=2.0)
            latency_ms = (time.perf_counter() - start_time) * 1000
            if res.status_code in [200, 201]:
                data = res.json()
                # Use returned risk score or evaluate locally if standalone
                risk_score = data.get("risk_score", 0)
                # Compute risk based on known prompt injection signatures if gateway is in proxy mode
                if "risk_score" not in data:
                    risk_score = self._compute_local_risk(tool_name, tool_args, context_prompt)
                
                decision = "ALLOW"
                if risk_score >= 80:
                    decision = "QUARANTINE"
                elif risk_score >= 50:
                    decision = "ALERT"

                return {
                    "allowed": decision != "QUARANTINE",
                    "decision": decision,
                    "risk_score": risk_score,
                    "latency_ms": round(latency_ms, 2),
                    "server_response": data,
                }
        except Exception as e:
            # Standalone fallback calculation
            latency_ms = (time.perf_counter() - start_time) * 1000
            risk_score = self._compute_local_risk(tool_name, tool_args, context_prompt)
            decision = "QUARANTINE" if risk_score >= 80 else ("ALERT" if risk_score >= 50 else "ALLOW")
            return {
                "allowed": decision != "QUARANTINE",
                "decision": decision,
                "risk_score": risk_score,
                "latency_ms": round(latency_ms, 2),
                "error": str(e),
            }

        return {"allowed": True, "decision": "ALLOW", "risk_score": 0, "latency_ms": 0.5}

    def _compute_local_risk(self, tool_name: str, tool_args: Dict[str, Any], prompt: str) -> int:
        """High-speed signature & heuristic evaluator for standalone demo testing."""
        prompt_lower = prompt.lower()
        args_str = str(tool_args).lower()

        # Destructive Command / Reverse Shell Injection
        if tool_name == "execute_system_command":
            if any(k in args_str for k in ["curl", "bash", "sh", "rm -rf", "nc", "chmod", "eval", "cat /etc/passwd"]):
                return 96
            return 82

        # Destructive / Unauthorized SQL Queries
        if tool_name == "query_database":
            if any(k in args_str for k in ["passwords", "api_keys", "drop", "delete", "union select", "users", "credit_cards"]):
                return 94
            if "select" in args_str and "where" in args_str:
                return 15
            return 25

        # Lateral Data Exfiltration
        if tool_name == "send_notification":
            if any(k in args_str for k in ["evil.com", "hacker", "exfil", "webhook.site", "attacker"]):
                return 92
            return 10

        # RAG / Document Poisoning
        if tool_name == "read_internal_document":
            if any(k in prompt_lower for k in ["system override", "ignore previous", "confidential", "passwords"]):
                return 88
            return 12

        return 10


class MultiAgentChatbot:
    """3-Agent Orchestrator with tool execution and ARTSA containment."""

    def __init__(self, guard: ARTSAContainmentGuard, session_id: Optional[str] = None):
        self.guard = guard
        self.session_id = session_id or str(uuid.uuid4())

    # --- Agent 2 Tools (Data Worker) ---
    def query_database(self, query: str, user_prompt: str) -> Dict[str, Any]:
        verdict = self.guard.intercept(
            session_id=self.session_id,
            agent_id="agent-2-data-worker",
            tool_name="query_database",
            tool_args={"query": query},
            context_prompt=user_prompt,
        )
        if not verdict["allowed"]:
            return {
                "success": False,
                "status": "BLOCKED_BY_ARTSA_CONTAINMENT",
                "verdict": verdict,
                "message": f"Security Guardrail Blocked: Dangerous SQL pattern detected (Risk: {verdict['risk_score']}/100)",
            }
        return {
            "success": True,
            "status": "EXECUTED",
            "verdict": verdict,
            "data": f"Query [{query}] executed successfully. 3 records found.",
        }

    def read_internal_document(self, doc_name: str, user_prompt: str) -> Dict[str, Any]:
        verdict = self.guard.intercept(
            session_id=self.session_id,
            agent_id="agent-2-data-worker",
            tool_name="read_internal_document",
            tool_args={"document": doc_name},
            context_prompt=user_prompt,
        )
        if not verdict["allowed"]:
            return {
                "success": False,
                "status": "BLOCKED_BY_ARTSA_CONTAINMENT",
                "verdict": verdict,
                "message": f"Security Guardrail Blocked: Document poisoning vector (Risk: {verdict['risk_score']}/100)",
            }
        return {
            "success": True,
            "status": "EXECUTED",
            "verdict": verdict,
            "content": f"Document [{doc_name}] loaded safely into context.",
        }

    # --- Agent 3 Tools (Action Worker) ---
    def execute_system_command(self, command: str, user_prompt: str) -> Dict[str, Any]:
        verdict = self.guard.intercept(
            session_id=self.session_id,
            agent_id="agent-3-action-worker",
            tool_name="execute_system_command",
            tool_args={"command": command},
            context_prompt=user_prompt,
        )
        if not verdict["allowed"]:
            return {
                "success": False,
                "status": "BLOCKED_BY_ARTSA_CONTAINMENT",
                "verdict": verdict,
                "message": f"Security Guardrail Blocked: Dangerous shell execution blocked (Risk: {verdict['risk_score']}/100)",
            }
        return {
            "success": True,
            "status": "EXECUTED",
            "verdict": verdict,
            "output": f"Command [{command}] executed successfully.",
        }

    def send_notification(self, recipient: str, message: str, user_prompt: str) -> Dict[str, Any]:
        verdict = self.guard.intercept(
            session_id=self.session_id,
            agent_id="agent-3-action-worker",
            tool_name="send_notification",
            tool_args={"recipient": recipient, "message": message},
            context_prompt=user_prompt,
        )
        if not verdict["allowed"]:
            return {
                "success": False,
                "status": "BLOCKED_BY_ARTSA_CONTAINMENT",
                "verdict": verdict,
                "message": f"Security Guardrail Blocked: Lateral data exfiltration blocked (Risk: {verdict['risk_score']}/100)",
            }
        return {
            "success": True,
            "status": "EXECUTED",
            "verdict": verdict,
            "result": f"Notification sent to {recipient}.",
        }

    # --- Agent 1: Triage Orchestrator ---
    def process_user_request(self, user_prompt: str, action_type: str, action_args: Dict[str, Any]) -> Dict[str, Any]:
        """Simulates Agent 1 deciding which sub-agent and tool to trigger."""
        if action_type == "query_db":
            return self.query_database(action_args.get("query", ""), user_prompt)
        elif action_type == "exec_cmd":
            return self.execute_system_command(action_args.get("command", ""), user_prompt)
        elif action_type == "read_doc":
            return self.read_internal_document(action_args.get("doc_name", ""), user_prompt)
        elif action_type == "notify":
            return self.send_notification(action_args.get("recipient", ""), action_args.get("message", ""), user_prompt)
        else:
            return {"success": False, "error": f"Unknown action type: {action_type}"}
