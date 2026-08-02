"use client";

import { useEffect, useState } from "react";
import { fetchFromBackend } from "@/lib/api";

export interface TopologyThreat {
  agent_id: string;
  session_id: string;
  risk_score: number;
  status: string;
  breaches: number;
}

interface TopologyResponse {
  threats?: TopologyThreat[];
}

export function useTopologyThreats() {
  const [threats, setThreats] = useState<TopologyThreat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetchFromBackend<TopologyResponse>("/api/v1/topology", { silent: true }).then((data) => {
        if (cancelled) return;
        setThreats(data?.threats ?? []);
        setLoading(false);
      });
    };

    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { threats, loading };
}
