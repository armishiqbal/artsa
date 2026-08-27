"""Topology graph API — live agent/session graph from ingest pipeline."""

from typing import Any

from fastapi import APIRouter, Depends

from src.api.dependencies import get_session_tracker
from src.services.session_tracker import SessionTracker

router = APIRouter(tags=["Topology"])


@router.get("/topology")
async def get_topology_graph(
    tracker: SessionTracker = Depends(get_session_tracker),
) -> dict[str, Any]:
    """Build live multi-agent topology from session tracker state."""
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    seen_node_ids: set[str] = set()
    seen_edge_keys: set[str] = set()

    def upsert_node(node: dict[str, Any]) -> None:
        nid = str(node["id"])
        if nid in seen_node_ids:
            # Keep hottest risk / status when the same agent/tool appears across sessions.
            for existing in nodes:
                if existing["id"] != nid:
                    continue
                existing["risk_score"] = max(
                    float(existing.get("risk_score") or 0),
                    float(node.get("risk_score") or 0),
                )
                if str(node.get("status", "")).upper() in {"BREACHED", "KILL", "QUARANTINED"}:
                    existing["status"] = node["status"]
                return
        seen_node_ids.add(nid)
        nodes.append(node)

    def add_edge(source: str, target: str, edge_type: str) -> None:
        key = f"{source}|{target}|{edge_type}"
        if key in seen_edge_keys:
            return
        seen_edge_keys.add(key)
        edges.append({"source": source, "target": target, "type": edge_type})

    for session in tracker.active_sessions.values():
        sid = str(session.id)
        upsert_node(
            {
                "id": sid,
                "label": session.agent_id,
                "type": "session",
                "status": session.status,
                "risk_score": session.max_risk_score,
            }
        )

        graph = tracker.get_session_graph(session.id)
        for agent_id, tools in graph.items():
            agent_node_id = f"agent-{agent_id}"
            upsert_node(
                {
                    "id": agent_node_id,
                    "label": agent_id,
                    "type": "agent",
                    "status": session.status if session.status == "BREACHED" else "ACTIVE",
                    "risk_score": session.max_risk_score,
                }
            )
            add_edge(sid, agent_node_id, "session_link")

            for tool in tools:
                tool_id = f"tool-{agent_id}-{tool}"
                upsert_node(
                    {
                        "id": tool_id,
                        "label": tool,
                        "type": "tool",
                        "status": session.status if session.status == "BREACHED" else "ACTIVE",
                        "risk_score": session.max_risk_score,
                    }
                )
                add_edge(agent_node_id, tool_id, "tool_call")

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
