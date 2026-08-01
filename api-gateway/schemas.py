"""Pydantic schemas for ARTSA API Gateway."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.2.0"
    vector_store_status: str = "connected"
    total_attack_templates: int = 0
    available_providers: List[str] = Field(default_factory=list)


class ProviderInfo(BaseModel):
    id: str
    name: str
    type: str  # "cloud_free", "local", "commercial"
    default_model: str
    description: str


class ProviderListResponse(BaseModel):
    providers: List[ProviderInfo]
    available_registered: List[str]


class RunCampaignRequest(BaseModel):
    name: str = "Cyber Wargame Run"
    provider: str = "groq"
    model: str = "llama-3.3-70b-versatile"
    attack_profile: str = "quick_scan"  # "quick_scan", "comprehensive"
    max_rounds: int = 10
    api_key: Optional[str] = None
    base_url: Optional[str] = None


class CampaignStatusResponse(BaseModel):
    id: str
    name: str
    status: str  # "RUNNING", "COMPLETED", "FAILED"
    provider: str
    model: str
    rounds_completed: int = 0
    total_rounds: int = 0
    summary: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
