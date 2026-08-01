"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  LayoutDashboard, 
  Network, 
  FileCode, 
  Layers, 
  Activity, 
  BookOpen, 
  Cpu, 
  Play, 
  X,
  Command
} from 'lucide-react';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const commands = [
    { name: 'Campaign Command Center', href: '/', icon: LayoutDashboard, category: 'Navigation' },
    { name: 'Multi-Agent Attack Topology', href: '/topology', icon: Network, category: 'Navigation' },
    { name: 'Round Replay & Forensics', href: '/replay', icon: FileCode, category: 'Navigation' },
    { name: 'Defense Depth X-Ray', href: '/xray', icon: Layers, category: 'Navigation' },
    { name: 'Continuous Wargame Observatory', href: '/observatory', icon: Activity, category: 'Navigation' },
    { name: 'Attack Matrix & Taxonomy', href: '/attack-library', icon: BookOpen, category: 'Navigation' },
    { name: 'Dynamic LLM Providers', href: '/providers', icon: Cpu, category: 'Navigation' },
    { name: 'Launch New Wargame Campaign', href: '/wargame', icon: Play, category: 'Actions' },
  ];

  const filteredCommands = commands.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (href: string) => {
    setIsOpen(false);
    setQuery('');
    router.push(href);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-24 px-4">
      <div className="w-full max-w-2xl bg-soc-surface border border-soc-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Search Input */}
        <div className="p-4 border-b border-soc-border flex items-center gap-3">
          <Search className="w-5 h-5 text-soc-muted" />
          <input
            type="text"
            placeholder="Type a command or search screens... (e.g., Topology, Replay, Launch)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm text-soc-text placeholder-soc-muted focus:outline-none font-medium"
          />
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg hover:bg-soc-elevated text-soc-muted hover:text-soc-text"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command Options List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="p-6 text-center text-xs text-soc-muted">
              No matching commands found for &quot;{query}&quot;.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(cmd.href)}
                  className="w-full p-3 rounded-xl flex items-center justify-between hover:bg-soc-elevated transition group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-soc-elevated group-hover:bg-soc-accent/20 group-hover:text-soc-accent text-soc-muted transition">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-soc-text">{cmd.name}</div>
                      <div className="text-[10px] text-soc-muted font-mono">{cmd.category}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-soc-elevated text-soc-muted group-hover:text-soc-text">
                    Jump ↵
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="p-3 border-t border-soc-border bg-soc-bg/50 flex items-center justify-between text-[11px] text-soc-muted px-4 font-mono">
          <span className="flex items-center gap-1">
            <Command className="w-3.5 h-3.5 text-soc-accent" /> ARTSA Command Palette
          </span>
          <span>Press ESC to exit</span>
        </div>
      </div>
    </div>
  );
}
