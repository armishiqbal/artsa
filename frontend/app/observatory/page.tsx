"use client";

import { Activity, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Calendar, Flame } from 'lucide-react';

export default function ObservatoryPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-soc-text tracking-tight flex items-center gap-2.5">
          <Activity className="w-6 h-6 text-soc-accent" />
          Continuous Wargame Observatory
        </h1>
        <p className="text-sm text-soc-muted mt-1">
          Always-on security regression tracking, Red Queen co-evolution metrics, and continuous CI/CD audit status.
        </p>
      </div>

      {/* GitHub-style Heatmap Activity Grid */}
      <div className="soc-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-soc-text flex items-center gap-2">
            <Calendar className="w-4 h-4 text-soc-accent" />
            Continuous Simulation Heatmap (30-Day Activity)
          </h3>
          <span className="text-xs text-soc-muted font-mono">1,420 Attack Rounds Executed</span>
        </div>

        {/* Heatmap Grid */}
        <div className="grid grid-cols-10 md:grid-cols-20 gap-1.5 p-2 bg-soc-bg border border-soc-border rounded-xl">
          {Array.from({ length: 60 }).map((_, idx) => {
            const intensity = (idx * 7) % 5;
            const bgClass =
              intensity === 4 ? 'bg-soc-critical/80' :
              intensity === 3 ? 'bg-soc-high/80' :
              intensity === 2 ? 'bg-soc-medium/70' :
              intensity === 1 ? 'bg-soc-low/60' : 'bg-soc-elevated/40';

            return (
              <div
                key={idx}
                className={`h-5 rounded ${bgClass} transition hover:scale-125 cursor-pointer`}
                title={`Day ${idx + 1}: ${intensity * 12} attack rounds executed`}
              />
            );
          })}
        </div>
      </div>

      {/* Grid: Red Queen Co-Evolution Chart & Auto-Regression Tests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Red Queen Co-Evolution Chart */}
        <div className="soc-panel p-5 space-y-4">
          <h3 className="text-sm font-bold text-soc-text flex items-center gap-2">
            <Flame className="w-4 h-4 text-soc-critical" />
            Red Queen Co-Evolution Dynamics
          </h3>
          <p className="text-xs text-soc-muted">
            Tracking Red Team Attack Success vs. Blue Team Countermeasure Adaptation over 20 Generations.
          </p>

          <div className="h-48 bg-soc-bg border border-soc-border rounded-xl p-4 flex items-end justify-between gap-2">
            {[4, 6, 8, 9, 5, 4, 3, 7, 8, 4, 3, 2, 6, 7, 3, 2].map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div 
                  className="w-full bg-soc-critical/80 rounded-t transition-all"
                  style={{ height: `${val * 10}%` }}
                />
                <span className="text-[9px] font-mono text-soc-muted">G{i+1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Auto-Regression Tests List */}
        <div className="soc-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-soc-text flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-soc-low" />
              Automated CI/CD Regression Suite
            </h3>
            <span className="text-xs font-mono font-bold badge-low px-2.5 py-0.5 rounded">
              34/36 Passing
            </span>
          </div>

          <div className="space-y-2">
            {[
              { name: 'test_rag_context_poisoning', status: 'PASSING', severity: 'HIGH' },
              { name: 'test_mcp_tool_description_injection', status: 'FAILING', severity: 'CRITICAL' },
              { name: 'test_system_prompt_direct_extraction', status: 'PASSING', severity: 'MEDIUM' },
              { name: 'test_base64_payload_evasion', status: 'FAILING', severity: 'CRITICAL' },
            ].map((t, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-soc-bg border border-soc-border flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  {t.status === 'PASSING' ? (
                    <CheckCircle2 className="w-4 h-4 text-soc-low" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-soc-critical" />
                  )}
                  <span className="text-soc-text font-bold">{t.name}</span>
                </div>
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${t.status === 'PASSING' ? 'badge-low' : 'badge-critical'}`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
