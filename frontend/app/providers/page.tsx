"use client";

import { useEffect, useState } from "react";
import { 
  Cpu, 
  CheckCircle2, 
  Server, 
  Lock, 
  Globe, 
  Plus, 
  ShieldCheck, 
  Search, 
  Zap, 
  Sliders, 
  RefreshCw,
  ExternalLink,
  Activity
} from "lucide-react";
import { fetchFromBackend } from "@/lib/api";

interface Provider {
  id: string;
  name: string;
  type: "cloud_api" | "cloud_free" | "local" | "custom";
  description: string;
  default_model: string;
  status: "ACTIVE" | "READY" | "CONFIGURED";
  latency_ms: number;
  icon: string;
}


const DEFAULT_PROVIDERS: Provider[] = [
  {
    id: "openai",
    name: "OpenAI Frontier",
    type: "cloud_api",
    description: "GPT-5.6, GPT-4o & SOL reasoning model backends via official API.",
    default_model: "gpt-5.6-terra",
    status: "ACTIVE",
    latency_ms: 38,
    icon: "⚡",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    type: "cloud_api",
    description: "Claude Opus 5 & Fable 5 models for red-teaming evaluation.",
    default_model: "claude-opus-5",
    status: "ACTIVE",
    latency_ms: 42,
    icon: "🧠",
  },
  {
    id: "groq",
    name: "Groq LPU Acceleration",
    type: "cloud_free",
    description: "Ultra-fast Llama 3 70B & Mixtral inference (500+ tokens/sec).",
    default_model: "llama3-70b-8192",
    status: "READY",
    latency_ms: 12,
    icon: "🚀",
  },
  {
    id: "ollama",
    name: "Ollama / Local GLM",
    type: "local",
    description: "Uncensored local GGUF weights running on self-hosted GPU node.",
    default_model: "glm-5.2-local",
    status: "READY",
    latency_ms: 8,
    icon: "🖥️",
  },
  {
    id: "deepseek",
    name: "DeepSeek Reasoning Cluster",
    type: "custom",
    description: "Reasoning model cluster for automated red-team logic mutation.",
    default_model: "deepseek-r1",
    status: "CONFIGURED",
    latency_ms: 65,
    icon: "🔮",
  },
  {
    id: "mistral",
    name: "Mistral AI Cluster",
    type: "cloud_api",
    description: "Mistral NeMo & Large endpoints for multi-agent swarm testing.",
    default_model: "mistral-large-2407",
    status: "READY",
    latency_ms: 45,
    icon: "🌌",
  },
];

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>(DEFAULT_PROVIDERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchFromBackend("/api/v1/agents")
      .then((data) => {
        if (data && data.providers && data.providers.length > 0) {
          setProviders(data.providers);
        }
      })
      .catch((err) => console.log("Using default provider registry fallback", err))
      .finally(() => setLoading(false));
  }, []);

  const filteredProviders = providers.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.default_model.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === "all" || p.type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold font-mono text-white flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            LLM Provider & Runtime Model Registry
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage plug-and-play LLM backends across cloud APIs, ultra-fast LPU accelerators, and local GGUF nodes.
          </p>
        </div>

        <button 
          onClick={() => alert("Provider Registration Wizard: Enter custom endpoint base_url and API key.")}
          className="px-3.5 py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold font-mono text-xs hover:bg-cyan-400 transition flex items-center gap-2 shadow-lg shadow-cyan-500/20"
        >
          <Plus className="w-4 h-4" /> Add Custom Provider
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0E1322] p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search provider or model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {["all", "cloud_api", "cloud_free", "local", "custom"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono capitalize transition ${
                filterType === type
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              {type.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Provider Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProviders.map((p) => (
          <div
            key={p.id}
            className="p-5 rounded-xl bg-[#0E1322] border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-4 group shadow-lg"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xl">{p.icon}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                    <Activity className="w-3 h-3 animate-pulse" /> {p.latency_ms}ms
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase border ${
                      p.type === "cloud_api"
                        ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                        : p.type === "local"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : p.type === "cloud_free"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    }`}
                  >
                    {p.type.replace("_", " ")}
                  </span>
                </div>
              </div>

              <h3 className="text-sm font-bold font-mono text-white mt-3 group-hover:text-cyan-400 transition">
                {p.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {p.description}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Default Model:</span>
                <span className="text-cyan-400 font-bold">{p.default_model}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Registry ID:</span>
                <span className="text-slate-300">{p.id}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Containment Intercept:</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Enforced
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic Endpoint Configuration Code Panel */}
      <div className="p-6 rounded-xl bg-[#0E1322] border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-400" />
          Adding Custom LLM Cluster Endpoints (Zero Code Required)
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          ARTSA features an automatic endpoint resolver. You can point any agent to ANY custom provider or self-hosted LLM cluster simply by passing a provider configuration:
        </p>

        <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800 text-cyan-300 font-mono text-xs overflow-x-auto">
{`target:
  provider: "my_custom_llm_cluster"
  model: "deepseek-r1-custom"
  base_url: "https://my-private-llm.company.org/v1"
  api_key: "sk-private-token"
  eds_monitoring: true`}
        </div>
      </div>
    </div>
  );
}
