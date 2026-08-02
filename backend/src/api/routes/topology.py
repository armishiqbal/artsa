"""Topology graph API — live agent/session graph from ingest pipeline."""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends

from src.api.dependencies import get_session_tracker
from src.services.session_tracker import SessionTracker

router = APIRouter(tags=["Topology"])


@router.get("/topology")
async def get_topology_graph(
    tracker: SessionTracker = Depends(get_session_tracker),
) -> Dict[str, Any]:
    """Build live multi-agent topology from session tracker state."""
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    seen_agents: set[str] = set()

    for session in tracker.active_sessions.values():
        sid = str(session.id)
        nodes.append(
            {
                "id": sid,
                "label": session.agent_id,
                "type": "session",
                "status": session.status,
                "risk_score": session.max_risk_score,
            }
        )
        seen_agents.add(session.agent_id)

        graph = tracker.get_session_graph(session.id)
        for agent_id, tools in graph.items():
            if agent_id not in seen_agents:
                nodes.append(
                    {
                        "id": f"agent-{agent_id}",
                        "label": agent_id,
                        "type": "agent",
                        "status": "ACTIVE",
                        "risk_score": session.max_risk_score,
                    }
                )
                seen_agents.add(agent_id)

            for tool in tools:
                tool_id = f"tool-{agent_id}-{tool}"
                nodes.append(
                    {
                        "id": tool_id,
                        "label": tool,
                        "type": "tool",
                        "status": "ACTIVE",
                        "risk_score": 0,
                    }
                )
                edges.append(
                    {
                        "source": f"agent-{agent_id}",
                        "target": tool_id,
                        "type": "tool_call",
                    }
                )
                edges.append(
                    {
                        "source": sid,
                        "target": f"agent-{agent_id}",
                        "type": "session_link",
                    }
                )

    threats = sorted(
        [
            {
                "agent_id": s.agent_id,
                "session_id": str(s.id),
                "risk_score": s.max_risk_score,
                "status": s.status,
                "breaches": s.containment_breaches,
            }
            for s in tracker.active_sessions.values()
            if s.max_risk_score >= 50 or s.status == "BREACHED"
        ],
        key=lambda t: t["risk_score"],
        reverse=True,
    )[:10]

    return {"nodes": nodes, "edges": edges, "threats": threats}
