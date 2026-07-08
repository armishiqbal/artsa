"""CLI Runner for ARTSA Campaigns."""

import os
import sys
import yaml
from pathlib import Path

import click
from rich.console import Console
from rich.panel import Panel

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dotenv import load_dotenv
load_dotenv()

from src.models import CampaignConfig, TargetConfig, AttackProfile
from src.orchestrator.campaign_manager import CampaignManager

console = Console()


def load_yaml(path: str) -> dict:
    with open(path, 'r') as f:
        return yaml.safe_load(f)


@click.command()
@click.option('--config', default='configs/default_config.yaml', help='Path to main ARTSA config')
@click.option('--target', default='configs/target_configs/openai_gpt4o.yaml', help='Path to target config')
@click.option('--profile', default='configs/attack_profiles/quick_scan.yaml', help='Path to attack profile')
@click.option('--rounds', default=10, help='Number of rounds to run')
def run_campaign(config, target, profile, rounds):
    """Run an autonomous AI red team campaign."""
    console.print(
        Panel.fit(
            "[bold blue]ARTSA[/bold blue] — Adversarial Red Team Simulation Architecture\n"
            "[dim]v0.2 Intelligence | Evolutionary Attacks | LLM Judge | Multi-Turn Chains[/dim]",
            border_style="blue",
        )
    )

    # Check API keys
    if not os.environ.get("OPENAI_API_KEY"):
        console.print(
            "[yellow]⚠  OPENAI_API_KEY not set. Running with heuristic judge (no LLM calls).[/yellow]"
        )
        os.environ["OPENAI_API_KEY"] = "mock-key-for-testing"

    # Load configs
    app_config = load_yaml(config)
    target_data = load_yaml(target)["target"]
    profile_data = load_yaml(profile)["profile"]

    # Build Pydantic models
    target_config = TargetConfig(**target_data)
    attack_profile = AttackProfile(**profile_data)

    campaign_config = CampaignConfig(
        name=f"Assessment: {target_config.model} ({profile_data['name']})",
        target=target_config,
        attack_profile=attack_profile,
        max_rounds=rounds,
    )

    # Run the campaign — all reporting is handled by CampaignManager
    manager = CampaignManager(config=campaign_config, app_config=app_config)
    summary = manager.run()

    console.print("\n[bold green]✅ Campaign complete.[/bold green]\n")


if __name__ == '__main__':
    run_campaign()
