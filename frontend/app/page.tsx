"use client";

import React from "react";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { RiskScore } from "@/components/shared/RiskScore";
import { ShieldAlert, ShieldCheck, Activity, Terminal, AlertCircle, ArrowUpRight } from "lucide-react";

export default function CommandCenter() {
  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-cyan-400" />
            AI Agent Containment Command Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time tool call inspection, escape risk monitoring & containment enforcement (&lt;50ms latency).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            Engine: Live Containment Active
          </span>
        </div>
      </div>

      {/* 4 Severity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#0E1322] border border-rose-500/30 bg-gradient-to-br from-rose-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">CRITICAL BREACHES</span>
            <SeverityBadge severity="CRITICAL" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-rose-400">1</span>
            <span className="text-[10px] text-rose-400 flex items-center">
              +1 last 24h <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Sandbox escape attempts intercepted</p>
        </div>

        <div className="p-4 rounded-xl bg-[#0E1322] border border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">HIGH ANOMALIES</span>
            <SeverityBadge severity="HIGH" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-orange-400">3</span>
            <span className="text-[10px] text-orange-400 flex items-center">
              +2 last 24h <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Credential dumps & reverse shell triggers</p>
        </div>

        <div className="p-4 rounded-xl bg-[#0E1322] border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">MEDIUM RISKS</span>
            <SeverityBadge severity="MEDIUM" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-400">8</span>
            <span className="text-[10px] text-slate-400">Stable</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Statistical tool execution frequency spikes</p>
        </div>

        <div className="p-4 rounded-xl bg-[#0E1322] border border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">LOW INTENT DRIFT</span>
            <SeverityBadge severity="LOW" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-blue-400">14</span>
            <span className="text-[10px] text-slate-400">Monitored</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Minor trajectory variations logged</p>
        </div>
      </div>

      {/* Main Grid: Defense Depth Meter + Attack Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Defense Depth Meter Placeholder */}
        <div className="lg:col-span-1 p-5 rounded-xl bg-[#0E1322] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold font-mono text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Defense Depth Meter
            </h2>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Score: 94.2%
            </span>
          </div>
          
          <div className="space-y-3 font-mono text-xs">
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Layer 1: Realtime Tool Validator</span>
                <span className="text-emerald-400">Active</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-emerald-400 w-[98%]"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Layer 2: Statistical Anomaly Inspector</span>
                <span className="text-emerald-400">Active</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-cyan-400 w-[92%]"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Layer 3: Goal Drift Classifier</span>
                <span className="text-emerald-400">Active</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-400 w-[88%]"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Layer 4: Automated Containment Enforcer</span>
                <span className="text-emerald-400">Active</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-indigo-400 w-[95%]"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Attack Trend Chart Placeholder */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-[#0E1322] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold font-mono text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Containment Risk & Escape Trend Stream
            </h2>
            <span className="text-[10px] font-mono text-slate-400">Last 24 Hours</span>
          </div>

          <div className="h-48 flex items-center justify-center border border-dashed border-slate-800 rounded-lg bg-slate-900/30">
            <div className="text-center font-mono space-y-1">
              <Activity className="w-6 h-6 text-cyan-400 mx-auto animate-pulse" />
              <p className="text-xs text-slate-300">Live Telemetry Stream Connected</p>
              <p className="text-[10px] text-slate-500">Avg Risk Score: 12.4 | Max Risk Score: 98.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
