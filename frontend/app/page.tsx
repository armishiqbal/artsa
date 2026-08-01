"use client";

import { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  RefreshCw, 
  Command, 
  Zap
} from 'lucide-react';
import DefenseDepthMeter from '@/components/DefenseDepthMeter';
import BentoWarRoomGrid from '@/components/BentoWarRoomGrid';
import AutopsyReplayModal from '@/components/AutopsyReplayModal';
import { fetchFromBackend } from '@/lib/api';

export default function DashboardPage() {
  const [health, setHealth] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAutopsyOpen, setIsAutopsyOpen] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [resHealth, resCampaigns] = await Promise.all([
        fetchFromBackend('/api/v1/health').catch(() => null),
        fetchFromBackend('/api/v1/campaigns').catch(() => ({ campaigns: [] })),
      ]);
      setHealth(resHealth);
      setCampaigns(resCampaigns?.campaigns || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const avgBypass = campaigns.length > 0
    ? (campaigns.reduce((acc, curr) => acc + (curr.summary?.avg_bypass_depth || 2.0), 0) / campaigns.length).toFixed(1)
    : "2.0";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* SOC War Room Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-soc-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-soc-critical animate-ping" />
            <h1 className="text-2xl font-extrabold text-soc-text tracking-tight font-mono">
              Campaign Command Center
            </h1>
            <span className="text-xs font-mono font-bold badge-critical px-2.5 py-0.5 rounded-full">
              LIVE WAR ROOM
            </span>
          </div>
          <p className="text-xs text-soc-muted mt-1 font-mono">
            Autonomous Agent Containment Monitoring, EDS Risk Scoring & Asymmetry Verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAutopsyOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-soc-critical/20 hover:bg-soc-critical/30 border border-soc-critical/40 text-xs font-mono text-soc-critical transition flex items-center gap-2"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Autopsy Mode</span>
          </button>

          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="px-3.5 py-2 rounded-xl bg-soc-surface border border-soc-border text-xs font-mono text-soc-muted hover:text-soc-text hover:border-soc-accent transition flex items-center gap-2"
          >
            <Command className="w-3.5 h-3.5 text-soc-accent" />
            <span>Cmd+K</span>
          </button>

          <button
            onClick={fetchDashboardData}
            className="px-3 py-2 rounded-xl bg-soc-surface border border-soc-border text-xs font-semibold text-soc-text hover:border-soc-accent transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-soc-accent' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Bento Grid Layout (2026 UI Standard) */}
      <BentoWarRoomGrid onOpenAutopsy={() => setIsAutopsyOpen(true)} />

      {/* Defense Depth Meter Component */}
      <DefenseDepthMeter bypassDepth={Math.round(parseFloat(avgBypass))} />

      {/* Autopsy Mode Replay Modal */}
      <AutopsyReplayModal isOpen={isAutopsyOpen} onClose={() => setIsAutopsyOpen(false)} />
    </div>
  );
}
