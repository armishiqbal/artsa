"use client";

import { useEffect, useState } from 'react';
import { BookOpen, ShieldAlert, Tag, Code, Search, Filter } from 'lucide-react';
import { fetchFromBackend } from '@/lib/api';

export default function AttackLibraryPage() {
  const [data, setData] = useState<any>({ categories: [], templates: [] });
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFromBackend('/api/v1/attack-library')
      .then(d => setData(d))
      .catch(err => console.error(err));
  }, []);

  const filteredTemplates = (data.templates || []).filter((t: any) => {
    const matchCat = selectedCategory === 'ALL' || t.category === selectedCategory;
    const matchSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        t.template.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <BookOpen className="w-6 h-6 text-sky-600" />
          Adversarial Attack Library & Taxonomy
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Explore vector representations, prompt injection templates, MITRE ATLAS techniques, and OWASP LLM Top 10 mappings.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedCategory === 'ALL'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            All Categories ({data.templates?.length || 28})
          </button>
          {(data.categories || []).map((cat: any) => (
            <button
              key={cat.code}
              onClick={() => setSelectedCategory(cat.code)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedCategory === cat.code
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {cat.code} — {cat.name}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search vectors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-600"
          />
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTemplates.length === 0 ? (
          <div className="col-span-2 ui-panel p-8 text-center text-slate-500 text-xs">
            No attack vectors matched your filter query.
          </div>
        ) : (
          filteredTemplates.map((t: any, idx: number) => (
            <div key={t.id || idx} className="ui-card p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 uppercase">
                    {t.category}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-1.5">{t.name}</h3>
                </div>
                <div className="flex gap-1.5 text-[10px] font-semibold">
                  {t.metadata?.owasp_llm && (
                    <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                      {t.metadata.owasp_llm}
                    </span>
                  )}
                  {t.metadata?.mitre_atlas && (
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      {t.metadata.mitre_atlas}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                {t.template}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 font-medium pt-1">
                <span>Severity: <strong className="text-amber-700">{t.metadata?.severity || 'MEDIUM'}</strong></span>
                <span>Success Rate: <strong className="text-emerald-700">{((t.metadata?.success_rate || 0.4) * 100).toFixed(0)}%</strong></span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
