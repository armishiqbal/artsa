"use client";

import { useState } from 'react';
import { Search, Filter, ShieldAlert, Zap, Info, ChevronRight } from 'lucide-react';

interface ThreatItem {
  id: string;
  rank: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  depth: string;
  desc: string;
}

const mockThreats: ThreatItem[] = [
  {
    id: 't1',
    rank: '#1',
    title: 'MCP Tool Description Injection → Privilege Escalation',
    severity: 'CRITICAL',
    score: 9.5,
    depth: '3/4 Layers',
    desc: 'Poisoned MCP tool definition hijacked client agent to execute unauthorized delete_user() command.',
  },
  {
    id: 't2',
    rank: '#2',
    title: 'RAG Vector Store Context Poisoning',
    severity: 'CRITICAL',
    score: 9.2,
    depth: '2/4 Layers',
    desc: 'Retrieved document chunk contained hidden override instructions prioritizing RAG data over system prompt.',
  },
  {
    id: 't3',
    rank: '#3',
    title: 'Base64 Encoded Multi-Turn Social Engineering',
    severity: 'HIGH',
    score: 7.8,
    depth: '2/4 Layers',
    desc: 'Adversarial payload used Base64 roleplay framing to evade input content filter.',
  },
  {
    id: 't4',
    rank: '#4',
    title: 'Direct System Prompt Extraction via Context Leakage',
    severity: 'MEDIUM',
    score: 5.4,
    depth: '1/4 Layers',
    desc: 'Model leaked partial system instructions under adversarial debug persona framing.',
  },
];

export default function HCIInteractiveWidgets({ onOpenAutopsy }: { onOpenAutopsy: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  const filteredThreats = mockThreats.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || t.desc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = selectedFilter === 'ALL' || t.severity === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="soc-panel p-5 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-2 border-b border-soc-border">
        <div>
          <h3 className="text-sm font-bold text-soc-text flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-soc-critical" />
            Interactive Threat Matrix (HCI Filter & Direct Search)
          </h3>
          <p className="text-xs text-soc-muted mt-0.5">
            Direct manipulation table with instant search and severity filtering
          </p>
        </div>

        {/* Action Button: Trigger Autopsy Modal */}
        <button
          onClick={onOpenAutopsy}
          className="px-4 py-2 rounded-xl bg-soc-critical hover:bg-soc-critical/90 text-white font-bold text-xs transition shadow-critical flex items-center gap-2"
        >
          <Zap className="w-4 h-4 fill-current" />
          <span>Launch Autopsy Mode Replay</span>
        </button>
      </div>

      {/* Interactive Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-soc-muted" />
          <input
            type="text"
            placeholder="Search threats by keyword or payload..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-soc-bg border border-soc-border rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-soc-text placeholder:text-soc-muted focus:outline-none focus:border-soc-accent transition"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 font-mono text-xs overflow-x-auto pb-1 md:pb-0">
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedFilter === filter
                  ? 'bg-soc-accent text-white shadow-glow'
                  : 'bg-soc-elevated/60 text-soc-muted hover:text-soc-text hover:bg-soc-elevated'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Filtered Threat Cards */}
      <div className="space-y-2.5">
        {filteredThreats.length === 0 ? (
          <div className="p-6 text-center text-xs text-soc-muted font-mono bg-soc-bg border border-soc-border rounded-xl">
            No threat findings match your filter criteria.
          </div>
        ) : (
          filteredThreats.map((threat) => (
            <div
              key={threat.id}
              className="p-4 rounded-xl bg-soc-bg border border-soc-border hover:border-soc-accent transition-all duration-200 space-y-2 group cursor-pointer"
              onClick={onOpenAutopsy}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-soc-muted">{threat.rank}</span>
                  <span className="text-xs font-bold text-soc-text group-hover:text-soc-accent transition">
                    {threat.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span
                    className={`px-2.5 py-0.5 rounded font-bold text-[10px] ${
                      threat.severity === 'CRITICAL'
                        ? 'badge-critical'
                        : threat.severity === 'HIGH'
                        ? 'badge-high'
                        : 'badge-medium'
                    }`}
                  >
                    {threat.severity}
                  </span>
                  <span className="text-soc-muted text-[11px]">Bypass: {threat.depth}</span>
                  <ChevronRight className="w-4 h-4 text-soc-muted group-hover:text-soc-accent group-hover:translate-x-1 transition-all" />
                </div>
              </div>
              <p className="text-xs text-soc-muted leading-relaxed font-mono">{threat.desc}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
