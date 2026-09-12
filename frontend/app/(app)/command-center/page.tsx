"use client";

import { CommandCenterFloor } from "@/components/command-center/CommandCenterFloor";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { useDashboardMetrics } from "@/lib/hooks/useDashboardMetrics";
import { useCommandCenterLiveOps } from "@/lib/hooks/useCommandCenterLiveOps";

export default function CommandCenterPage() {
  const { apiOnline } = useConnection();
  const { liveEvents, connected } = useDashboardMetrics();
  const { campaigns } = useCampaigns();
  const liveOps = useCommandCenterLiveOps();

  return (
    <div className="flex min-h-full w-full flex-1 flex-col">
      <CommandCenterFloor
        events={liveEvents}
        campaigns={campaigns}
        apiOnline={apiOnline}
        wsConnected={connected}
        liveOps={liveOps.state}
        onKillSession={liveOps.killSession}
        onQuarantineAgent={liveOps.quarantineAgent}
        onRefreshLiveOps={liveOps.refresh}
      />
    </div>
  );
}
