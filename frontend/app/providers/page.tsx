"use client";

import { useEffect, useState } from 'react';
import { Cpu, CheckCircle2, Server, Lock, Globe, Plus, ShieldCheck } from 'lucide-react';
import { fetchFromBackend } from '@/lib/api';

export default function ProvidersPage() {
  const [providerData, setProviderData] = useState<any>({ providers: [], available_registered: [] });

  useEffect(() => {
    fetchFromBackend('/api/v1/providers')
      .then(d => setProviderData(d))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <Cpu className="w-6 h-6 text-sky-600" />
          Dynamic LLM Provider & Model Registry
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage plug-and-play LLM backends across free cloud APIs, local inference servers, and custom OpenAI-compatible endpoints.
        </p>
      </div>

      {/* Grid of Providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(providerData.providers || []).map((p: any) => (
          <div key={p.id} className="ui-card p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  p.type === 'cloud_free' ? 'bg-sky-50 text-sky-800 border border-sky-200' :
                  p.type === 'local' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                  'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  {p.type.replace('_', ' ')}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 mt-2.5">{p.name}</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{p.description}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Default Model:</span>
                <span className="text-sky-700 font-bold font-mono">{p.default_model}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Registry Code:</span>
                <span className="text-slate-800 font-mono font-semibold">{p.id}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic Endpoint Explanation Card */}
      <div className="ui-panel p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Globe className="w-5 h-5 text-sky-600" />
          Adding New Providers Dynamically (Zero Code Required)
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          ARTSA features an automatic endpoint resolver. You can point any agent to ANY custom provider or self-hosted LLM cluster simply by passing a <code className="text-sky-700 font-mono bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">provider</code> name and <code className="text-sky-700 font-mono bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">base_url</code> in your configuration:
        </p>

        <div className="p-4 rounded-xl bg-slate-900 text-cyan-300 font-mono text-xs overflow-x-auto">
{`target:
  provider: "my_custom_llm_cluster"
  model: "deepseek-r1-custom"
  base_url: "https://my-private-llm.company.org/v1"
  api_key: "sk-private-token"`}
        </div>
      </div>
    </div>
  );
}
