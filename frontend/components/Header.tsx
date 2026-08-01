"use client";

import { Terminal, Play, Command, Cpu } from 'lucide-react';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="h-16 border-b border-soc-border bg-soc-surface/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-soc-bg border border-soc-border text-xs text-soc-muted font-mono">
          <Terminal className="w-3.5 h-3.5 text-soc-accent" />
          <span>API Gateway:</span>
          <span className="text-soc-low font-bold">http://localhost:8000</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-soc-elevated border border-soc-border text-xs font-mono text-soc-muted hover:text-soc-text hover:border-soc-accent transition"
        >
          <Command className="w-3.5 h-3.5 text-soc-accent" />
          <span>Cmd+K</span>
        </button>

        <Link 
          href="/wargame"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-soc-accent hover:bg-soc-accent/90 text-white font-bold text-xs transition shadow-glow"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Launch Wargame</span>
        </Link>
      </div>
    </header>
  );
}
