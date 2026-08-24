import {
  buildControlPlaneGraph,
  buildGraphFromTelemetry,
  buildGraphFromTopology,
  deriveCommandGraph,
  layoutNodes,
} from "@/lib/commandGraph";

describe("commandGraph", () => {
  it("layouts nodes deterministically", () => {
    const a = layoutNodes(4);
    const b = layoutNodes(4);
    expect(a).toEqual(b);
    expect(a).toHaveLength(4);
  });

  it("builds graph from topology payload", () => {
    const graph = buildGraphFromTopology({
      nodes: [
        { id: "s1", label: "agent-a", type: "session", risk_score: 90, status: "BREACHED" },
        { id: "agent-a", label: "agent-a", type: "agent", risk_score: 90, status: "ACTIVE" },
        { id: "tool-x", label: "read_file", type: "tool", risk_score: 0 },
      ],
      edges: [
        { source: "s1", target: "agent-a", type: "session_link" },
        { source: "agent-a", target: "tool-x", type: "tool_call" },
      ],
    });
    expect(graph).not.toBeNull();
    expect(graph!.source).toBe("topology");
    expect(graph!.nodes).toHaveLength(3);
    expect(graph!.edges).toHaveLength(2);
    expect(graph!.compromisedCount).toBeGreaterThan(0);
  });

  it("builds graph from telemetry events", () => {
    const graph = buildGraphFromTelemetry([
      {
        agent_id: "scout",
        tool_name: "query_db",
        risk_score: 72,
        verdict: "SUSPICIOUS",
        session_id: "sess-1",
      },
      {
        agent_id: "scout",
        tool_name: "query_db",
        risk_score: 40,
        verdict: "SAFE",
        session_id: "sess-1",
      },
      {
        agent_id: "writer",
        tool_name: "write_file",
        risk_score: 10,
        verdict: "SAFE",
        session_id: "sess-2",
      },
    ]);
    expect(graph).not.toBeNull();
    expect(graph!.source).toBe("telemetry");
    expect(graph!.nodes.some((n) => n.label === "scout")).toBe(true);
    expect(graph!.edges.some((e) => e.label === "query_db" && e.count === 2)).toBe(true);
  });

  it("falls back to control plane when empty", () => {
    const graph = deriveCommandGraph({ topology: null, events: [] });
    expect(graph.source).toBe("control_plane");
    expect(graph.nodes.length).toBe(6);
    expect(graph.edges.length).toBe(6);
  });

  it("prefers topology over telemetry", () => {
    const graph = deriveCommandGraph({
      topology: {
        nodes: [{ id: "a1", label: "live", type: "agent", risk_score: 5 }],
        edges: [],
      },
      events: [{ agent_id: "ignored", tool_name: "x", risk_score: 99 }],
    });
    expect(graph.source).toBe("topology");
    expect(graph.nodes[0]?.label).toBe("live");
  });

  it("builds control plane from agent statuses", () => {
    const graph = buildControlPlaneGraph([
      { id: "research", label: "Research", status: "online" },
      { id: "curator", label: "Curator", status: "alert" },
    ]);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes.find((n) => n.id === "ctrl-curator")?.severity).toBe("HIGH");
  });
});
