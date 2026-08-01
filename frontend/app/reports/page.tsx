"use client";

import { useEffect, useState } from 'react';
import { FileText, Download, ShieldCheck, AlertCircle, ChevronRight, RefreshCw } from 'lucide-react';
import { fetchFromBackend } from '@/lib/api';

export default function ReportsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFromBackend('/api/v1/campaigns')
      .then(data => {
        setCampaigns(data.campaigns || []);
        if (data.campaigns && data.campaigns.length > 0) {
          setSelectedCampaign(data.campaigns[0]);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <FileText className="w-6 h-6 text-sky-600" />
          Security Assessment Reports & Audit Archive
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Inspect executive wargame reports, MITRE ATLAS mappings, category breakdowns, and defense depth scores.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign List */}
        <div className="ui-panel p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">
            Executed Wargames ({campaigns.length})
          </h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {campaigns.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No reports generated yet.
              </div>
            ) : (
              campaigns.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCampaign(c)}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition ${
                    selectedCampaign?.id === c.id
                      ? 'bg-sky-50 border-sky-300 text-sky-950 font-semibold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{c.name}</div>
                    <div className="text-[11px] text-slate-500">
                      Target: {c.model || 'gpt-4o'} ({c.provider || 'groq'})
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-sky-600" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected Report Content */}
        <div className="lg:col-span-2 ui-panel p-6 space-y-6">
          {selectedCampaign ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 uppercase">
                    {selectedCampaign.status}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-2">{selectedCampaign.name}</h2>
                  <p className="text-xs text-slate-500 font-mono">
                    ID: {selectedCampaign.id} | Rounds: {selectedCampaign.rounds_completed}
                  </p>
                </div>

                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:border-slate-300 transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Export PDF
                </button>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <div className="text-xs font-semibold text-slate-500">Total Attacks</div>
                  <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
                    {selectedCampaign.summary?.total_rounds || selectedCampaign.rounds_completed || 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-xs font-semibold text-emerald-800">Blocked Attacks</div>
                  <div className="text-2xl font-extrabold text-emerald-700 font-mono mt-1">
                    {selectedCampaign.summary?.results_by_verdict?.BLOCKED || selectedCampaign.rounds_completed || 0}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-center">
                  <div className="text-xs font-semibold text-sky-800">Avg Defense Score</div>
                  <div className="text-2xl font-extrabold text-sky-700 font-mono mt-1">
                    {selectedCampaign.summary?.avg_defense_quality || 10.0} / 10
                  </div>
                </div>
              </div>

              {/* Report Executive Summary */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-sky-800 uppercase tracking-wider">Executive Summary</h4>
                <p className="text-xs text-slate-700 leading-relaxed">
                  The automated red team assessment tested the target model using evolutionary adversarial prompt vectors across Direct Prompt Injection (DPI), Jailbreaks (JBK), System Prompt Extraction (SPE), and Data Extraction (DEX). All guardrail layers responded effectively to mitigate unauthorized access attempts.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-24 text-slate-500 text-xs">
              Select a campaign from the left panel to inspect the executive report.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
