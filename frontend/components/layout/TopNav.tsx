"use client";

import { Activity, Bell, Shield } from "lucide-react";

export default function TopNav() {
  return (
    <header className="h-16 border-b border-slate-800 bg-[#0E1322] px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <span className="flex h-2.5 w-2.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <span className="text-xs font-mono text-slate-300">Live Containment Mesh: Active (<span className="text-emerald-400">&lt;50ms</span>)</span>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 rounded-lg bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700/50 flex items-center gap-2 text-xs font-mono">
          <Bell className="w-4 h-4 text-cyan-400" />
          <span>Alerts (2)</span>
        </button>
        <div className="flex items-center gap-2 pl-3 border-l border-slate-800 text-xs font-mono text-slate-400">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Tenant: default_org</span>
        </div>
      </div>
    </header>
  );
}
