"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Command, Play, FileText, Shield } from "lucide-react";
import { navSections } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const actionCommands = [
  { name: "Launch Wargame Campaign", href: "/campaigns", category: "Actions", icon: Play },
  { name: "View Reports", href: "/reports", category: "Actions", icon: FileText },
  { name: "Open Session Replay", href: "/replay", category: "Actions", icon: Shield },
  { name: "Configure Providers", href: "/admin/providers", category: "Actions", icon: Command },
];

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navCommands = navSections.flatMap((section) =>
    section.items.map((item) => ({
      name: item.name,
      href: item.href,
      icon: item.icon,
      category: section.label,
    }))
  );

  const commands = [...navCommands, ...actionCommands];

  const filteredCommands = commands.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (href: string) => {
    setIsOpen(false);
    setQuery("");
    router.push(href);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 px-4 pt-24 backdrop-blur-sm"
      role="presentation"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border p-4">
          <Search className="h-5 w-5 text-muted-foreground" aria-hidden />
          <Input
            type="text"
            placeholder="Search pages and actions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Close command palette">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-96 space-y-1 overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">
              No matching commands for &quot;{query}&quot;.
            </p>
          ) : (
            filteredCommands.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={`${cmd.category}-${cmd.href}-${cmd.name}`}
                  type="button"
                  onClick={() => handleSelect(cmd.href)}
                  className="flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{cmd.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{cmd.category}</div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    ↵
                  </Badge>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-3 font-mono text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Command className="h-3.5 w-3.5 text-primary" aria-hidden />
            ARTSA Command Palette
          </span>
          <span>ESC to close · ⌘K to open</span>
        </div>
      </div>
    </div>
  );
}
