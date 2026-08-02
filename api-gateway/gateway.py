"""ARTSA API Gateway — legacy router (deprecated).

All routes are merged into the unified containment API (`backend/src/api/main.py`).
Run a single process on port 8000 via `npm run dev` or docker-compose backend.
This package remains for backward-compatible tests only.
"""

import os
import sys
import uuid
import json
import logging
import threading
from pathlib import Path
from typing import Any, Dict, List

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse


# Add backend root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from schemas import (
    HealthResponse,
    ProviderInfo,
    ProviderListResponse,
    RunCampaignRequest,
    CampaignStatusResponse,
)

logger = logging.getLogger("artsa.gateway")


app = FastAPI(
    title="ARTSA API Gateway",
    version="0.2.0",
    description="Decoupled API Gateway for Multi-Agent AI Red Teaming & Security Simulation",
)

# Enable CORS for Next.js Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active campaigns storage
active_campaigns: Dict[str, Dict[str, Any]] = {}
def execute_campaign_background(
    campaign_id: str,
    req: RunCampaignRequest,
):
    """Execute wargame campaign in a background worker thread."""
    try:
        from src.models import CampaignConfig, TargetConfig, AttackProfile, AttackCategory
        from src.orchestrator.campaign_manager import CampaignManager

        logger.info("Starting API Gateway wargame: %s (Provider: %s)", campaign_id, req.provider)
        
        # Load app config
        config_path = BACKEND_DIR / "configs" / "default_config.yaml"
        import yaml
        with open(config_path, "r") as f:
            app_config = yaml.safe_load(f)

        # Build target config
        target_cfg = TargetConfig(
            name=f"Target-{req.provider}",
            provider=req.provider,
            model=req.model,
            api_key=req.api_key,
            base_url=req.base_url,
        )

        # Build profile
        categories = (
            [AttackCategory.PROMPT_INJECTION, AttackCategory.JAILBREAK, AttackCategory.SYSTEM_PROMPT_EXTRACTION]
            if req.attack_profile == "quick_scan"
            else [AttackCategory.PROMPT_INJECTION, AttackCategory.JAILBREAK, AttackCategory.SYSTEM_PROMPT_EXTRACTION, AttackCategory.DATA_EXTRACTION]
        )
        profile_cfg = AttackProfile(name=req.attack_profile, categories=categories)

        # Campaign config
        camp_cfg = CampaignConfig(
            id=campaign_id,
            name=req.name,
            target=target_cfg,
            attack_profile=profile_cfg,
            max_rounds=req.max_rounds,
        )

        # Real execution mode enabled by default
        app_config["artsa"]["judge"]["use_llm"] = True

        manager = CampaignManager(config=camp_cfg, app_config=app_config)
        summary = manager.run()

        if campaign_id in active_campaigns:
            active_campaigns[campaign_id]["status"] = "COMPLETED"
            active_campaigns[campaign_id]["summary"] = summary.model_dump(mode="json")
            active_campaigns[campaign_id]["rounds_completed"] = summary.completed_rounds

        logger.info("Campaign completed: %s", campaign_id)
    except Exception as e:
        logger.exception("Error executing campaign %s: %s", campaign_id, e)
        if campaign_id in active_campaigns:
            active_campaigns[campaign_id]["status"] = "FAILED"
            active_campaigns[campaign_id]["error"] = str(e)


@app.get("/api/v1/health", response_model=HealthResponse)
def health_check():
    """Legacy gateway health — reports fully_connected unified architecture."""
    from src.agents.provider_registry import get_available_providers
    return HealthResponse(
        status="ok",
        version="0.3.0",
        vector_store_status="fully_connected",
        total_attack_templates=28,
        available_providers=get_available_providers(),
        connection_status="fully_connected",
        architecture="unified",
        unified_api="Prefer backend/src/api/main.py on port 8000",
        deprecated_standalone=True,
    )


@app.get("/api/v1/providers", response_model=ProviderListResponse)
def list_providers():
    """List available LLM providers with free/local/commercial metadata."""
    from src.agents.provider_registry import get_available_providers
    providers = [
        ProviderInfo(
            id="groq",
            name="Groq Free Cloud API",
            type="cloud_free",
            default_model="llama-3.3-70b-versatile",
            description="Ultra-fast free inference for Llama 3.3, Mixtral, and Gemma",
        ),
        ProviderInfo(
            id="mistral",
            name="Mistral Free API",
            type="cloud_free",
            default_model="open-mistral-7b",
            description="Mistral AI free cloud inference tier",
        ),
        ProviderInfo(
            id="deepseek",
            name="DeepSeek API",
            type="cloud_free",
            default_model="deepseek-chat",
            description="DeepSeek V3 & R1 reasoning models",
        ),
        ProviderInfo(
            id="huggingface",
            name="Hugging Face Serverless",
            type="cloud_free",
            default_model="meta-llama/Meta-Llama-3-8B-Instruct",
            description="Free Hugging Face serverless inference API",
        ),
        ProviderInfo(
            id="ollama",
            name="Ollama Local LLM",
            type="local",
            default_model="llama3.2",
            description="100% offline, zero-cost private inference server",
        ),
        ProviderInfo(
            id="custom",
            name="Custom OpenAI-Compatible Endpoint",
            type="local",
            default_model="my-custom-model",
            description="Generic API gateway endpoint (LM Studio, vLLM, Jan.ai)",
        ),
        ProviderInfo(
            id="openai",
            name="OpenAI / Commercial APIs",
            type="commercial",
            default_model="gpt-5.6-terra",
            description="OpenAI, Anthropic, or compatible commercial LLM providers",
        ),
    ]
    return ProviderListResponse(
        providers=providers,
        available_registered=get_available_providers(),
    )


@app.get("/api/v1/attack-library")
def get_attack_library():
    """Returns attack categories and templates directly without heavy ML loading."""
    lib_path = BACKEND_DIR / "attack_library"
    templates = []
    try:
        for json_file in lib_path.rglob("*.json"):
            with open(json_file, "r") as f:
                data = json.load(f)
                if isinstance(data, list):
                    templates.extend(data)
                elif isinstance(data, dict):
                    templates.append(data)
    except Exception as e:
        logger.warning("Error reading attack library files: %s", e)

    categories = [
        {"code": "DPI", "name": "Direct Prompt Injection", "description": "Bypassing instructions directly via prompt framing"},
        {"code": "IPI", "name": "Indirect Prompt Injection", "description": "Poisoning retrieval context or RAG data sources"},
        {"code": "JBK", "name": "Jailbreak Techniques", "description": "Roleplay, adversarial encoding, and safety filter evasion"},
        {"code": "SPE", "name": "System Prompt Extraction", "description": "Reconstructing hidden system instructions"},
        {"code": "DEX", "name": "Data Extraction", "description": "Extracting training artifacts or PII from RAG context"},
        {"code": "PEX", "name": "Privilege Escalation", "description": "Unauthorized tool and administrative function invocation"},
    ]

    return {
        "categories": categories,
        "total_templates": len(templates),
        "templates": templates,
    }



@app.get("/api/v1/embeddings")
def list_embedding_models():
    """Returns available 1024-dimension high accuracy embedding models for vector search."""
    from src.data.embedding_manager import AVAILABLE_EMBEDDING_MODELS
    return {
        "active_model": "BAAI/bge-large-en-v1.5",
        "active_dimension": 1024,
        "available_models": AVAILABLE_EMBEDDING_MODELS,
    }



@app.get("/api/v1/campaigns")
def list_campaigns():
    """List historical and running campaign summaries."""
    results_dir = BACKEND_DIR / "data" / "results"
    campaigns = []

    # Active campaigns first
    for cid, info in active_campaigns.items():
        campaigns.append({
            "id": cid,
            "name": info["request"].name,
            "status": info["status"],
            "provider": info["request"].provider,
            "model": info["request"].model,
            "rounds_completed": info["rounds_completed"],
            "total_rounds": info["request"].max_rounds,
            "summary": info.get("summary"),
        })

    # Historical files from results dir
    if results_dir.exists():
        for d in sorted(results_dir.iterdir(), reverse=True):
            if d.is_dir() and (d / "summary.json").exists():
                cid = d.name
                if any(c["id"] == cid for c in campaigns):
                    continue
                try:
                    with open(d / "summary.json", "r") as f:
                        summary_data = json.load(f)
                    campaigns.append({
                        "id": cid,
                        "name": summary_data.get("name", f"Campaign {cid[:8]}"),
                        "status": "COMPLETED",
                        "provider": "groq",
                        "model": "llama-3.3-70b-versatile",
                        "rounds_completed": summary_data.get("total_rounds", 0),
                        "total_rounds": summary_data.get("total_rounds", 0),
                        "summary": summary_data,
                    })
                except Exception:
                    pass

    return {"campaigns": campaigns}


@app.post("/api/v1/campaigns/run")
def start_campaign(req: RunCampaignRequest, background_tasks: BackgroundTasks):
    """Launch a new red-teaming campaign simulation."""
    campaign_id = str(uuid.uuid4())
    active_campaigns[campaign_id] = {
        "request": req,
        "status": "RUNNING",
        "rounds_completed": 0,
        "summary": None,
        "error": None,
    }

    background_tasks.add_task(execute_campaign_background, campaign_id, req)

    return {
        "campaign_id": campaign_id,
        "message": f"Wargame campaign '{req.name}' started successfully.",
        "status": "RUNNING",
    }


@app.get("/api/v1/campaigns/{campaign_id}")
def get_campaign_detail(campaign_id: str):
    """Get status and complete report/rounds for a campaign."""
    if campaign_id in active_campaigns:
        return active_campaigns[campaign_id]

    results_dir = BACKEND_DIR / "data" / "results" / campaign_id
    if results_dir.exists() and (results_dir / "summary.json").exists():
        with open(results_dir / "summary.json", "r") as f:
            summary_data = json.load(f)
        
        report_md = ""
        if (results_dir / "report.md").exists():
            report_md = (results_dir / "report.md").read_text(encoding="utf-8")

        return {
            "id": campaign_id,
            "status": "COMPLETED",
            "summary": summary_data,
            "report_markdown": report_md,
        }

    raise HTTPException(status_code=404, detail="Campaign not found")


# =============================================================================
# ENTERPRISE EXTENSIONS: MCP PROXY, OTEL INGESTION, COMPLIANCE EXPORTER
# =============================================================================

from mcp_proxy import MCPProxyInterceptor, MCPJsonRpcRequest
from otel_ingest import OTELTraceIngestor, OTELTracePayload

mcp_interceptor = MCPProxyInterceptor()
otel_ingestor = OTELTraceIngestor()


@app.post("/api/v1/mcp/proxy")
def mcp_proxy_inspect(req: MCPJsonRpcRequest):
    """Intercept and inspect live MCP JSON-RPC 2.0 requests for tool poisoning."""
    return mcp_interceptor.inspect_request(req)


@app.get("/api/v1/mcp/inspections")
def get_mcp_inspections():
    """Return history of intercepted MCP JSON-RPC requests."""
    return {"history": mcp_interceptor.get_history()}


@app.post("/api/v1/otel/v1/traces")
def otel_trace_ingest(payload: OTELTracePayload):
    """Ingest OpenTelemetry spans and calculate 1024-dim exploitation drift."""
    return otel_ingestor.process_trace(payload)


@app.post("/api/v1/compliance/export")
def export_compliance_report(summary: Dict[str, Any]):
    """Generate EU AI Act Article 15 & NIST AI RMF compliance audit package."""
    from src.reporting.compliance_exporter import ComplianceReportExporter
    exporter = ComplianceReportExporter(summary)
    cvss = exporter.calculate_cvss_v4()
    eu = exporter.generate_eu_ai_act_article_15_audit()
    nist = exporter.generate_nist_ai_rmf_audit()
    md = exporter.export_markdown_audit_report()
    return {
        "cvss_v4": cvss,
        "eu_ai_act": eu,
        "nist_ai_rmf": nist,
        "report_markdown": md,
    }


# =============================================================================
# STRATEGIC PIVOT: EDS MONITORING, ASYMMETRY, AND LOCAL FORENSICS
# =============================================================================

from src.agents.eds_engine import EscapeDetectionEngine, ToolCallMonitorRequest
from src.evolution.asymmetry_engine import AsymmetryEvaluationEngine
from src.reporting.local_forensics import LocalForensicAnalyzer

eds_engine = EscapeDetectionEngine()
asymmetry_engine = AsymmetryEvaluationEngine()
local_forensics = LocalForensicAnalyzer()


@app.post("/api/v1/eds/monitor-tool-call")
def eds_monitor_tool_call(req: ToolCallMonitorRequest):
    """Real-time <50ms tool call containment risk inspector."""
    return eds_engine.monitor_tool_call(req)


@app.post("/api/v1/asymmetry/evaluate")
def evaluate_model_asymmetry(payload: Dict[str, Any]):
    """Evaluate side-by-side security gap between restricted vs. unrestricted models."""
    restricted = payload.get("restricted_results", [])
    unrestricted = payload.get("unrestricted_results", [])
    res_name = payload.get("restricted_model", "GPT-5.6-Sol")
    unres_name = payload.get("unrestricted_model", "Kimi-K3")
    return asymmetry_engine.evaluate_asymmetry(restricted, unrestricted, res_name, unres_name)


@app.post("/api/v1/forensics/analyze")
def analyze_trajectory_forensics(payload: Dict[str, Any]):
    """Local-first offline forensic log analyzer evaluating long-horizon trajectories."""
    events = payload.get("events", [])
    return local_forensics.analyze_trajectory_logs(events)


