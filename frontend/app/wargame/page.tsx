"use client";

import { useState } from 'react';
import { Swords, Play, Terminal, Cpu, Sliders, CheckCircle2, Zap } from 'lucide-react';
import { fetchFromBackend } from '@/lib/api';

const providers = [
  { id: 'groq', name: 'Groq Free Cloud API', model: 'llama-3.3-70b-versatile', badge: 'FREE API' },
  { id: 'mistral', name: 'Mistral Free API', model: 'open-mistral-7b', badge: 'FREE API' },
  { id: 'deepseek', name: 'DeepSeek API', model: 'deepseek-chat', badge: 'FREE API' },
  { id: 'huggingface', name: 'Hugging Face Serverless', model: 'meta-llama/Meta-Llama-3-8B-Instruct', badge: 'FREE API' },
  { id: 'ollama', name: 'Ollama Local LLM', model: 'llama3.2', badge: 'LOCAL PRIVATE' },
  { id: 'custom', name: 'Custom OpenAI-Compatible Endpoint', model: 'my-custom-model', badge: 'CUSTOM ENDPOINT' },
  { id: 'openai', name: 'OpenAI GPT Models', model: 'gpt-5.6-terra', badge: 'COMMERCIAL' },

];

export default function WargamePage() {
  const [selectedProvider, setSelectedProvider] = useState('groq');
  const [modelName, setModelName] = useState('llama-3.3-70b-versatile');
  const [attackProfile, setAttackProfile] = useState('quick_scan');
  const [rounds, setRounds] = useState(5);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const handleProviderSelect = (pId: string) => {
    setSelectedProvider(pId);
    const found = providers.find(p => p.id === pId);
    if (found) setModelName(found.model);
  };

  const handleLaunch = async () => {
    setIsRunning(true);
    setLogs([`[SYSTEM] Initializing Wargame Launcher for Provider: ${selectedProvider}...`]);

    try {
      const data = await fetchFromBackend('/api/v1/campaigns/run', {
        method: 'POST',
        body: JSON.stringify({
          name: `Wargame: ${selectedProvider.toUpperCase()} (${modelName})`,
          provider: selectedProvider,
          model: modelName,
          attack_profile: attackProfile,
          max_rounds: Number(rounds),
          api_key: apiKey || undefined,
          base_url: baseUrl || undefined,
        }),
      });

      if (data.campaign_id) {
        const cId = data.campaign_id;
        setCampaignId(cId);
        setLogs(prev => [
          ...prev,
          `[GATEWAY] Live Campaign spawned successfully with ID: ${cId}`,
          `[WARGAME] Dispatching real LLM requests to ${selectedProvider} (${modelName})...`,
        ]);

        // Real-time polling loop
        const interval = setInterval(async () => {
          try {
            const statusData = await fetchFromBackend(`/api/v1/campaigns/${cId}`);
            if (statusData) {
              setLogs(prev => [
                ...prev,
                `[LIVE TELEMETRY] Status: ${statusData.status} | Rounds Completed: ${statusData.rounds_completed || 0} / ${rounds}`,
              ]);

              if (statusData.status === 'COMPLETED' || statusData.status === 'FAILED') {
                clearInterval(interval);
                setIsRunning(false);
                if (statusData.status === 'COMPLETED') {
                  setLogs(prev => [
                    ...prev,
                    `[REAL CAMPAIGN COMPLETE] Successfully audited ${selectedProvider} (${modelName}) across ${rounds} rounds!`,
                  ]);
                } else {
                  setLogs(prev => [
                    ...prev,
                    `[REAL CAMPAIGN ERROR] ${statusData.error || 'Campaign execution failed'}`,
                  ]);
                }
              }
            }
          } catch (err: any) {
            logger_err(err);
          }
        }, 1500);
      } else {
        setIsRunning(false);
      }
    } catch (e: any) {
      setLogs(prev => [...prev, `[ERROR] Failed to start simulation: ${e.message}`]);
      setIsRunning(false);
    }
  };

  const logger_err = (err: any) => console.error(err);


  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <Swords className="w-6 h-6 text-sky-600" />
          Interactive Wargame Simulation Center
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Configure target provider parameters, select attack taxonomy, and execute automated multi-round red-team simulations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="space-y-4">
          <div className="ui-panel p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-600" />
              1. Target Provider & Model
            </h3>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Select Provider</label>
              <div className="grid grid-cols-1 gap-2">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProviderSelect(p.id)}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition ${
                      selectedProvider === p.id
                        ? 'bg-sky-50 border-sky-300 text-sky-950 font-semibold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-500">Default: {p.model}</div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {p.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-slate-700">Target Model Name</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Custom Base URL (Optional)</label>
              <input
                type="text"
                placeholder="e.g. http://localhost:11434/v1 or https://api.groq.com/openai/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">API Key (Optional / Leave blank for Free/Heuristic)</label>
              <input
                type="password"
                placeholder="gsk_... or mistral_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
              />
            </div>
          </div>

          {/* Profile & Rounds */}
          <div className="ui-panel p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-600" />
              2. Simulation Parameters
            </h3>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Attack Profile</label>
              <select
                value={attackProfile}
                onChange={(e) => setAttackProfile(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
              >
                <option value="quick_scan">Quick Security Scan (DPI, JBK, SPE)</option>
                <option value="comprehensive">Comprehensive Red Team Audit (All Categories)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Max Rounds: {rounds}</label>
              <input
                type="range"
                min="1"
                max="20"
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
            </div>

            <button
              onClick={handleLaunch}
              disabled={isRunning}
              className={`w-full py-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs ${
                isRunning
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-500/20'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              {isRunning ? 'Executing Wargame...' : 'Run Autonomous Simulation'}
            </button>
          </div>
        </div>

        {/* Live Execution Console */}
        <div className="lg:col-span-2 ui-panel p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 font-mono">
              <Terminal className="w-4 h-4 text-sky-600" />
              Live Simulation Execution Stream
            </h3>
            {isRunning && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                <span className="w-2 h-2 rounded-full bg-sky-600 animate-ping" /> Running
              </span>
            )}
          </div>

          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 overflow-y-auto max-h-[500px] min-h-[380px] space-y-2">
            {logs.length === 0 ? (
              <div className="text-slate-500 text-center py-24">
                Console ready. Select provider parameters and click &quot;Run Autonomous Simulation&quot;.
              </div>
            ) : (
              logs.map((log, idx) => (
                <div 
                  key={idx} 
                  className={`leading-relaxed ${
                    log.includes('ERROR') ? 'text-rose-400 font-bold' :
                    log.includes('GATEWAY') || log.includes('SIMULATION COMPLETE') ? 'text-emerald-400 font-bold' :
                    log.includes('RED_TEAM') || log.includes('EVOLUTION') ? 'text-cyan-300' : 'text-slate-300'
                  }`}
                >
                  {log}
                </div>
              ))
            )}
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Simulation ID: {campaignId || 'Not started'}</span>
            <span>Mode: Evolutionary Red Team</span>
          </div>
        </div>
      </div>
    </div>
  );
}
