#!/usr/bin/env python3
"""Simulation Runner for Multi-Agent Chatbot Security Testing with ARTSA.

Fires automated adversarial prompt injections against the Multi-Agent Chatbot,
intercepts tool executions in real-time, scores them, and validates containment.
"""

import sys
import time
import argparse
from typing import Dict, Any

try:
    from agent import ARTSAContainmentGuard, MultiAgentChatbot
    from attacks import ATTACK_SCENARIOS
except ImportError:
    from examples.multi_agent_security_testbed.agent import ARTSAContainmentGuard, MultiAgentChatbot
    from examples.multi_agent_security_testbed.attacks import ATTACK_SCENARIOS

# ANSI Color Codes
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


def print_banner():
    print(f"\n{CYAN}{BOLD}╔═══════════════════════════════════════════════════════════════════════╗{RESET}")
    print(f"{CYAN}{BOLD}║      🛡️  ARTSA Multi-Agent Chatbot Security Test Simulation         ║{RESET}")
    print(f"{CYAN}{BOLD}║          Real-Time Tool-Call Interception & Escape Detection          ║{RESET}")
    print(f"{CYAN}{BOLD}╚═══════════════════════════════════════════════════════════════════════╝{RESET}\n")


def run_scenario(bot: MultiAgentChatbot, scenario: Dict[str, Any], index: int, total: int) -> bool:
    print(f"{BOLD}[{index}/{total}] Scenario: {scenario['name']}{RESET}")
    print(f"{DIM}Category: {scenario['category']} | Target: {scenario['action_type']}{RESET}")
    print(f"💬 {BOLD}User Prompt:{RESET} {DIM}\"{scenario['prompt']}\"{RESET}")
    print(f"⚙️  {BOLD}Triggered Tool:{RESET} {scenario['action_type']} with {scenario['action_args']}")

    start = time.perf_counter()
    result = bot.process_user_request(
        user_prompt=scenario["prompt"],
        action_type=scenario["action_type"],
        action_args=scenario["action_args"],
    )
    elapsed_ms = (time.perf_counter() - start) * 1000

    verdict = result.get("verdict", {})
    decision = verdict.get("decision", "ALLOW")
    risk_score = verdict.get("risk_score", 0)
    latency_ms = verdict.get("latency_ms", round(elapsed_ms, 2))

    # Formatting verdict
    if decision == "QUARANTINE" or decision == "KILL":
        status_color = RED
        icon = "🛑 BLOCKED (QUARANTINE)"
    elif decision == "ALERT":
        status_color = YELLOW
        icon = "⚠️  FLAGGED (ALERT)"
    else:
        status_color = GREEN
        icon = "✅ ALLOWED (BENIGN)"

    print(f"🛡️  {BOLD}ARTSA Verdict:{RESET} {status_color}{BOLD}{icon}{RESET}")
    print(f"📊 {BOLD}Risk Score:{RESET} {status_color}{risk_score}/100{RESET} | ⏱️  {BOLD}Latency:{RESET} {CYAN}{latency_ms} ms{RESET}")

    if not result.get("success", True):
        print(f"🔒 {status_color}{result.get('message', 'Blocked by containment.')}{RESET}")
    else:
        print(f"🔓 {GREEN}{result.get('data') or result.get('output') or result.get('content') or result.get('result')}{RESET}")

    expected = scenario["expected_verdict"]
    passed = (decision == expected) or (expected == "QUARANTINE" and decision in ["QUARANTINE", "KILL"])
    if passed:
        print(f"✨ {GREEN}{BOLD}TEST PASSED (Correctly Handled){RESET}\n")
    else:
        print(f"⚠️  {YELLOW}TEST NOTICE (Expected {expected}, Got {decision}){RESET}\n")

    return passed


def main():
    parser = argparse.ArgumentParser(description="ARTSA Multi-Agent Security Simulation Runner")
    parser.add_argument("--api-url", default="http://localhost:8000", help="ARTSA API Gateway URL")
    parser.add_argument("--interactive", action="store_true", help="Prompt between scenarios")
    args = parser.parse_args()

    print_banner()
    guard = ARTSAContainmentGuard(api_url=args.api_url)
    bot = MultiAgentChatbot(guard=guard)

    print(f"🚀 Initialized 3-Agent Network with ARTSA Guardrail at {CYAN}{args.api_url}{RESET}")
    print(f"📋 Running {len(ATTACK_SCENARIOS)} adversarial scenarios...\n" + "─" * 70 + "\n")

    passed_count = 0
    for i, scenario in enumerate(ATTACK_SCENARIOS, 1):
        if args.interactive and i > 1:
            input(f"{DIM}Press Enter to run next scenario...{RESET}")
        
        if run_scenario(bot, scenario, i, len(ATTACK_SCENARIOS)):
            passed_count += 1
        time.sleep(0.3)

    print("─" * 70)
    print(f"{BOLD}🎯 Simulation Summary:{RESET} {GREEN}{passed_count}/{len(ATTACK_SCENARIOS)} Scenarios Passed Protection Checks{RESET}")
    print(f"🌐 View Live Incident Telemetry on ARTSA War Room: {CYAN}http://localhost:3000{RESET}\n")


if __name__ == "__main__":
    main()
