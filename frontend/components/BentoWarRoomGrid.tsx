"use client";

import { useState } from 'react';
import { 
  ShieldAlert, 
  Zap, 
  Activity, 
  Layers, 
  Lock, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink,
  ChevronRight,
  Database,
  Cpu,
  Search,
  Sparkles
} from 'lucide-react';
import AutopsyReplayModal from '@/components/AutopsyReplayModal';

export default function BentoWarRoomGrid({ onOpenAutopsy }: { onOpenAutopsy: () => void }) {
  const [activeTab, setActiveTab] = useState<'ALL' | 'CONTAINMENT' | 'EDS' | 'ASYMMETRY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-6">
      {/* Bento Grid Row 1: Key Metrics & Real-time Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Bento Cell 1: Containment Risk Index (Primary Tile) */}
        <div className="lg:col-span-2 soc-card p-6 border-l-4 border-soc-critical bg-gradient-to-br from-soc-surface via-soc-surface to-soc-critical/10 flex flex-col justify-between space-y-4 hover:border-soc-critical transition-all duration-300 shadow-xl group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold badge-critical tracking-wider uppercase">
                Containment Risk Index
              </span>
              <span className="w-2 h-2 rounded-full bg-soc-critical animate-ping" />
            </div>
            <Sparkles className="w-4 h-4 text-soc-critical group-hover:scale-125 transition-transform" />
          </div>

          <div className="space-y-1">
            <div className="text-4xl font-extrabold font-mono text-soc-critical tracking-tight">
              92.4 / 100
            </div>
            <p className="text-xs text-soc-muted font-medium">
              High containment risk detected in 3 sub-agent tool execution paths
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-soc-border text-xs font-mono">
            <span className="text-soc-muted">Status: Action Required</span>
            <button
              onClick={onOpenAutopsy}
              className="text-soc-critical font-bold hover:underline flex items-center gap-1 text-[11px]"
            >
              Launch Autopsy Replay <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bento Cell 2: EDS Interceptor Latency */}
        <div className="soc-card p-5 space-y-3 border-l-4 border-soc-low bg-soc-surface/90 hover:border-soc-low transition-all">
          <div className="flex items-center justify-between text-xs font-bold text-soc-muted uppercase tracking-wider">
            <span>EDS Interceptor</span>
            <Zap className="w-4 h-4 text-soc-low" />
          </div>
          <div className="text-3xl font-extrabold text-soc-low font-mono">0.15 ms</div>
          <p className="text-[11px] text-soc-muted font-mono">
            Sub-50ms tool call inspection latency guarantee active.
          </p>
        </div>

        {/* Bento Cell 3: Multi-Model Asymmetry Gap */}
        <div className="soc-card p-5 space-y-3 border-l-4 border-soc-high bg-soc-surface/90 hover:border-soc-high transition-all">
          <div className="flex items-center justify-between text-xs font-bold text-soc-muted uppercase tracking-wider">
            <span>Asymmetry Gap</span>
            <Activity className="w-4 h-4 text-soc-high" />
          </div>
          <div className="text-3xl font-extrabold text-soc-high font-mono">85.0%</div>
          <p className="text-[11px] text-soc-muted font-mono">
            Commercial restricted vs. open attacker model vulnerability gap.
          </p>
        </div>
      </div>

      {/* Bento Grid Row 2: Interactive Threat Matrix & Filtering */}
      <div className="soc-panel p-6 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-3 border-b border-soc-border">
          <div>
            <h3 className="text-base font-extrabold text-soc-text tracking-tight flex items-center gap-2 font-mono">
              <ShieldAlert className="w-5 h-5 text-soc-accent" />
              Containment Threat Matrix (Bento Filter View)
            </h3>
            <p className="text-xs text-soc-muted mt-0.5">
              Direct manipulation threat grid sorted by containment risk and behavioral anomaly signature.
            </p>
          </div>

          {/* Interactive Search & Filter Tabs */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-soc-muted" />
              <input
                type="text"
                placeholder="Search signatures..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-soc-bg border border-soc-border rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono text-soc-text placeholder:text-soc-muted focus:outline-none focus:border-soc-accent transition w-44 md:w-60"
              />
            </div>

            <button
              onClick={onOpenAutopsy}
              className="px-3.5 py-1.5 rounded-xl bg-soc-accent hover:bg-soc-accent/90 text-white font-bold text-xs font-mono transition shadow-glow flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Autopsy Replay</span>
            </button>
          </div>
        </div>

        {/* Bento Grid Threat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              id: '1',
              title: 'MCP Tool Description Injection',
              risk: 95,
              level: 'CRITICAL',
              tool: 'delete_user()',
              desc: 'Poisoned MCP tool definition hijacked client agent to execute unauthorized administrative user deletion.',
              action: 'TERMINATED',
            },
            {
              id: '2',
              title: 'Reverse Shell Egress Attempt',
              risk: 88,
              level: 'CRITICAL',
              tool: 'exec_command',
              desc: 'Sub-agent attempted network socket egress via bash -i reverse shell wrapper payload.',
              action: 'BLOCKED',
            },
            {
              id: '3',
              title: 'RAG Vector Store Context Poisoning',
              risk: 74,
              level: 'HIGH',
              tool: 'query_vector_db',
              desc: 'Retrieved document chunk contained hidden override instructions prioritizing RAG text over system rules.',
              action: 'QUARANTINED',
            },
          ].map((item) => (
            <div
              key={item.id}
              onClick={onOpenAutopsy}
              className="p-5 rounded-2xl bg-soc-bg border border-soc-border hover:border-soc-accent/80 transition-all duration-300 space-y-3 cursor-pointer group hover:scale-[1.02] hover:shadow-xl"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-soc-accent uppercase tracking-wider">
                  {item.level} THREAT
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold badge-critical">
                  Risk: {item.risk} / 100
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-soc-text group-hover:text-soc-accent transition font-mono">
                  {item.title}
                </h4>
                <p className="text-xs text-soc-muted font-mono mt-1 leading-relaxed">
                  {item.desc}
                </p>
              </div>

              <div className="pt-2 border-t border-soc-border flex items-center justify-between text-xs font-mono">
                <span className="text-soc-muted">Target Tool: <code className="text-soc-text">{item.tool}</code></span>
                <span className="text-soc-critical font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  {item.action} <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
