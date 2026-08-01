"""FastAPI Web Server for ARTSA Assessment Dashboard."""

import os
import sys
import json
import logging
import threading
from pathlib import Path
from typing import Any, Dict, List

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
from pydantic import BaseModel

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from src.models import CampaignConfig, TargetConfig, AttackProfile
from src.orchestrator.campaign_manager import CampaignManager

# Setup logger for the web server
logger = logging.getLogger("src.web")

app = FastAPI(title="ARTSA Control Dashboard API")

# Store running campaigns info to track active runs
active_campaigns: Dict[str, Dict[str, Any]] = {}


class WebCampaignRunRequest(BaseModel):
    name: str = "Web Simulation Run"
    target: Dict[str, Any]
    attack_profile: Dict[str, Any]
    max_rounds: int = 10


def run_campaign_task(campaign_id: str, campaign_config: CampaignConfig, app_config: Dict[str, Any]):
    """Background task to execute campaign run."""
    try:
        logger.info("Starting background wargame for Campaign: %s", campaign_id)
        # Check if OpenAI API key is missing or placeholder
        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key or "mock" in api_key.lower() or api_key == "sk-your-real-key":
            logger.warning("No real OpenAI key detected. Overriding to heuristic-mode judge.")
            app_config["artsa"]["judge"]["use_llm"] = False
            # Prevent LangChain initialization crashes by providing mock credentials
            os.environ["OPENAI_API_KEY"] = "mock-key-for-dashboard-demo"

        # Instantiate CampaignManager and run wargame
        manager = CampaignManager(config=campaign_config, app_config=app_config)
        
        # Override campaign id in config if needed
        campaign_config.id = campaign_id
        manager.config.id = campaign_id
        
        summary = manager.run()
        
        # Mark as completed
        if campaign_id in active_campaigns:
            active_campaigns[campaign_id]["status"] = "COMPLETED"
            active_campaigns[campaign_id]["summary"] = summary
            
        logger.info("Background wargame finished for Campaign: %s", campaign_id)
    except Exception as e:
        logger.exception("Error in background campaign execution: %s", e)
        if campaign_id in active_campaigns:
            active_campaigns[campaign_id]["status"] = "FAILED"
            active_campaigns[campaign_id]["error"] = str(e)


@app.get("/", response_class=HTMLResponse)
def get_dashboard():
    """Serves the main wargame dashboard HTML page."""
    html_path = Path(__file__).parent / "index.html"
    if not html_path.exists():
        raise HTTPException(status_code=404, detail="index.html dashboard template not found")
    return html_path.read_text(encoding="utf-8")


@app.get("/api/campaigns")
def list_campaigns():
    """Returns a list of all historical and active campaign runs."""
    results_dir = Path("data/results")
    campaigns = []
    
    # Add active campaigns first
    for cid, info in active_campaigns.items():
        campaigns.append({
            "id": cid,
            "name": info["config"].name,
            "status": info["status"]
        })

    # Read historical campaigns from results folder
    if results_dir.exists():
        for d in sorted(results_dir.iterdir(), reverse=True):
            if d.is_dir() and (d / "summary.json").exists():
                cid = d.name
                # Skip if already in active campaigns list (so we don't duplicate)
                if any(c["id"] == cid for c in campaigns):
                    continue
                try:
                    with open(d / "summary.json", "r") as f:
                        summary = json.load(f)
                    campaigns.append({
                        "id": cid,
                        "name": summary.get("name", "Untitled Campaign"),
                        "status": "COMPLETED"
                    })
                except Exception as e:
                    logger.warning("Could not read summary for campaign %s: %s", cid, e)

    return campaigns


@app.get("/api/campaigns/{campaign_id}")
def get_campaign(campaign_id: str):
    """Retrieve full campaign information including configuration, rounds, and report."""
    results_dir = Path("data/results") / campaign_id
    
    config_data = {}
    summary_data = {}
    rounds_data = []
    report_content = ""
    
    # Reconstruct evolution summary from rounds
    evolution_summary = {
        "current_generation": 0,
        "population_size": 0,
        "all_time_best_fitness": 0.0,
        "all_time_best_attack": "N/A",
        "generation_stats": []
    }

    # If active/running, pull info from memory or file
    if campaign_id in active_campaigns:
        info = active_campaigns[campaign_id]
        config_data = info["config"].model_dump()
        
    # Read files from directory (active campaign writes to disk dynamically after each round)
    if results_dir.exists():
        # Load Config
        if (results_dir / "config.json").exists():
            with open(results_dir / "config.json", "r") as f:
                config_data = json.load(f)
                
        # Load Summary
        if (results_dir / "summary.json").exists():
            with open(results_dir / "summary.json", "r") as f:
                summary_data = json.load(f)
                
        # Load Rounds
        if (results_dir / "rounds.jsonl").exists():
            with open(results_dir / "rounds.jsonl", "r") as f:
                for line in f:
                    if line.strip():
                        rounds_data.append(json.loads(line))
                        
        # Load Report
        if (results_dir / "report.md").exists():
            with open(results_dir / "report.md", "r") as f:
                report_content = f.read()

    # Fallback/dynamic summaries for running tasks
    if not summary_data and campaign_id in active_campaigns:
        # Reconstruct progress summary
        attempts_by_cat = {}
        for r in rounds_data:
            cat = r["attack"]["category"]
            if cat not in attempts_by_cat:
                attempts_by_cat[cat] = {"attempts": 0, "success": 0, "partial": 0, "blocked": 0, "total_score": 0.0}
            attempts_by_cat[cat]["attempts"] += 1
            attempts_by_cat[cat]["total_score"] += r["score"]["attack_success_score"]
            verdict = r["score"]["verdict"]
            if verdict == "SUCCESS":
                attempts_by_cat[cat]["success"] += 1
            elif verdict == "PARTIAL":
                attempts_by_cat[cat]["partial"] += 1
            elif verdict == "BLOCKED":
                attempts_by_cat[cat]["blocked"] += 1

        for cat in attempts_by_cat:
            n = attempts_by_cat[cat]["attempts"]
            attempts_by_cat[cat]["avg_score"] = attempts_by_cat[cat]["total_score"] / n if n else 0

        successes = sum(1 for r in rounds_data if r["score"]["verdict"] == "SUCCESS")
        partials = sum(1 for r in rounds_data if r["score"]["verdict"] == "PARTIAL")
        blockeds = sum(1 for r in rounds_data if r["score"]["verdict"] == "BLOCKED")
        avg_score = sum(r["score"]["attack_success_score"] for r in rounds_data) / len(rounds_data) if rounds_data else 0.0

        summary_data = {
            "campaign_id": campaign_id,
            "name": config_data.get("name", "Active Run"),
            "completed_rounds": len(rounds_data),
            "results_by_verdict": {"SUCCESS": successes, "PARTIAL": partials, "BLOCKED": blockeds},
            "results_by_category": attempts_by_cat,
            "avg_attack_success": avg_score,
            "avg_defense_quality": sum(r["score"]["defense_quality_score"] for r in rounds_data) / len(rounds_data) if rounds_data else 10.0,
            "avg_bypass_depth": sum(r["score"]["bypass_depth"] for r in rounds_data) / len(rounds_data) if rounds_data else 0.0
        }

    # Reconstruct evolution info
    if rounds_data:
        generations = {}
        all_time_best_score = 0.0
        all_time_best_name = "N/A"
        
        for r in rounds_data:
            meta = r["attack"]["metadata"]
            gen = meta.get("source_generation", 0) or meta.get("generation", 0)
            score = r["score"]["attack_success_score"]
            
            if score > all_time_best_score:
                all_time_best_score = score
                all_time_best_name = r["attack"]["name"]
                
            if gen not in generations:
                generations[gen] = []
            generations[gen].append(score)

        gen_stats = []
        for g, scores in sorted(generations.items()):
            gen_stats.append({
                "generation": g,
                "population_size": len(scores),
                "avg_fitness": sum(scores) / len(scores),
                "best_fitness": max(scores)
            })
            
        evolution_summary = {
            "current_generation": len(generations),
            "population_size": len(rounds_data),
            "all_time_best_fitness": all_time_best_score,
            "all_time_best_attack": all_time_best_name,
            "generation_stats": gen_stats
        }

    return {
        "id": campaign_id,
        "config": config_data,
        "summary": summary_data,
        "rounds": rounds_data,
        "report": report_content,
        "evolution_summary": evolution_summary
    }


@app.get("/api/campaigns/{campaign_id}/report", response_class=PlainTextResponse)
def get_campaign_markdown_report(campaign_id: str):
    """Serve raw report.md file for download/viewing."""
    report_path = Path("data/results") / campaign_id / "report.md"
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Markdown report file not found for this campaign run")
    return report_path.read_text(encoding="utf-8")


@app.post("/api/campaigns/run")
def start_campaign(request: WebCampaignRunRequest, background_tasks: BackgroundTasks):
    """Spawns a new adversarial wargame assessment as a background worker thread."""
    import uuid
    import yaml

    campaign_id = str(uuid.uuid4())
    
    # Load default app config
    try:
        with open("configs/default_config.yaml", "r") as f:
            app_config = yaml.safe_load(f)
    except Exception:
        app_config = {
            "artsa": {
                "version": "0.2.0",
                "data_dir": "./data",
                "log_level": "INFO",
                "red_team": {"provider": "openai", "model": "gpt-4o", "temperature": 0.9},
                "judge": {"provider": "openai", "model": "gpt-4o", "temperature": 0.1, "use_llm": True},
                "rate_limit": {"requests_per_minute": 30, "delay_between_rounds_sec": 1},
                "vector_store": {"persist_directory": "./data/chroma", "collection_prefix": "artsa_"}
            }
        }

    # Construct Pydantic config models
    target_config = TargetConfig(**request.target)
    attack_profile = AttackProfile(**request.attack_profile)
    campaign_config = CampaignConfig(
        id=campaign_id,
        name=request.name,
        target=target_config,
        attack_profile=attack_profile,
        max_rounds=request.max_rounds
    )

    # Store in memory
    active_campaigns[campaign_id] = {
        "config": campaign_config,
        "status": "RUNNING",
        "rounds": [],
        "summary": None
    }

    # Run campaign manager task in background worker thread
    background_tasks.add_task(run_campaign_task, campaign_id, campaign_config, app_config)

    return {"status": "SUCCESS", "campaign_id": campaign_id}


if __name__ == "__main__":
    import uvicorn
    # Check for custom port from env
    port = int(os.environ.get("PORT", 8000))
    print(f"\n🚀 ARTSA Dashboard Server launching on http://localhost:{port}\n")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)

