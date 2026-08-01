"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Network,
  FileCode,
  Layers,
  Activity,
  ChevronRight,
  Command,
  Swords,
  BookOpen,
  Cpu
} from 'lucide-react';

const navItems = [
  { name: 'Command Center', href: '/', icon: LayoutDashboard },
  { name: 'Attack Topology', href: '/topology', icon: Network },
  { name: 'Round Forensics', href: '/replay', icon: FileCode },
  { name: 'Defense X-Ray', href: '/xray', icon: Layers },
  { name: 'Observatory', href: '/observatory', icon: Activity },
  { name: 'Live Wargame', href: '/wargame', icon: Swords },
  { name: 'Attack Matrix', href: '/attack-library', icon: BookOpen },
  { name: 'Providers Registry', href: '/providers', icon: Cpu },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-soc-border bg-soc-surface flex flex-col h-screen sticky top-0 z-40 shadow-xl">
      <div className="p-5 border-b border-soc-border flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-soc-accent text-white shadow-glow">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-tight text-soc-text flex items-center gap-1.5 font-mono">
            ARTSA <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded badge-info">v0.3</span>
          </h1>
          <p className="text-[11px] text-soc-muted font-medium">SOC Security Mesh</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-bold tracking-wider text-soc-muted uppercase font-mono">
          War Room Controls
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-soc-elevated text-soc-accent font-bold border-l-4 border-soc-accent shadow-xs'
                  : 'text-soc-muted hover:text-soc-text hover:bg-soc-elevated/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-soc-accent' : 'text-soc-muted'}`} />
                <span>{item.name}</span>
              </div>
              {isActive && <ChevronRight className="w-3.5 h-3.5 text-soc-accent" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-soc-border m-3 rounded-xl bg-soc-bg border border-soc-border space-y-2">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="w-full p-2 rounded-lg bg-soc-elevated border border-soc-border flex items-center justify-between text-[11px] font-mono text-soc-muted hover:text-soc-text hover:border-soc-accent transition"
        >
          <span className="flex items-center gap-1.5">
            <Command className="w-3.5 h-3.5 text-soc-accent" /> Command Palette
          </span>
          <span className="text-[10px] bg-soc-bg px-1.5 py-0.5 rounded border border-soc-border">⌘K</span>
        </button>
      </div>
    </aside>
  );
}
