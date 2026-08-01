"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, LayoutDashboard, Activity, AlertTriangle, Layers, Users } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Command Center", href: "/", icon: LayoutDashboard },
    { name: "Live Observatory", href: "/observatory", icon: Activity },
    { name: "Attack Matrix", href: "/attack-library", icon: Layers },
    { name: "Agents Registry", href: "/providers", icon: Users },
    { name: "Alerts Feed", href: "/reports", icon: AlertTriangle },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-[#0E1322] flex flex-col h-screen sticky top-0 z-40">
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-tight text-white font-mono flex items-center gap-1.5">
            ARTSA <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">v0.3</span>
          </h1>
          <p className="text-[11px] text-slate-400">AI Escape Containment</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
          Containment Controls
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                isActive
                  ? "bg-slate-800 text-cyan-400 font-semibold border-l-2 border-cyan-400"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
