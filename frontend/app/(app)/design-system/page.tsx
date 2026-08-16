"use client";

import { useState } from "react";
import { Copy, Check, ChevronDown, Eye, Palette, Hash, Layers, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Logo, { LogoIcon } from "@/components/shared/Logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ── Color Token Data ──────────────────────────────────────────────── */

const TOKEN_SECTIONS = [
  {
    id: "brand",
    label: "Brand",
    icon: Palette,
    tokens: [
      { name: "--brand", value: "225 95% 68%", preview: "bg-brand", text: "text-brand", description: "Primary brand blue" },
      { name: "--brand-foreground", value: "0 0% 100%", preview: "bg-brand-foreground", text: "text-brand-foreground", description: "Text on brand backgrounds" },
      { name: "--brand-subtle", value: "225 95% 12%", preview: "bg-brand/10", text: "text-brand", description: "Subtle brand background" },
      { name: "--brand-muted", value: "225 40% 22%", preview: "bg-brand-muted", text: "text-brand/60", description: "Muted brand accent" },
      { name: "--brand-ring", value: "225 95% 68%", preview: "ring-1 ring-brand", text: "text-brand", description: "Focus ring" },
    ],
  },
  {
    id: "surface",
    label: "Surface",
    icon: Layers,
    tokens: [
      { name: "--background", value: "228 28% 6%", preview: "bg-background border", text: "", description: "Page background" },
      { name: "--foreground", value: "210 40% 96%", preview: "bg-foreground", text: "", description: "Primary text" },
      { name: "--card", value: "228 24% 8%", preview: "bg-card border", text: "", description: "Card / elevated surface" },
      { name: "--popover", value: "228 24% 9%", preview: "bg-popover border", text: "", description: "Popover / dropdown" },
      { name: "--border", value: "228 14% 16%", preview: "bg-border/30", text: "", description: "Default border" },
      { name: "--muted", value: "228 12% 15%", preview: "bg-muted", text: "", description: "Muted background" },
      { name: "--muted-foreground", value: "220 10% 58%", preview: "bg-muted-foreground", text: "", description: "Muted text" },
    ],
  },
  {
    id: "severity",
    label: "Severity",
    icon: Eye,
    tokens: [
      { name: "--severity-critical", value: "0 84% 56%", preview: "bg-severity-critical", text: "text-severity-critical", description: "Critical risk" },
      { name: "--severity-high", value: "24 92% 55%", preview: "bg-severity-high", text: "text-severity-high", description: "High risk" },
      { name: "--severity-medium", value: "42 92% 50%", preview: "bg-severity-medium", text: "text-severity-medium", description: "Medium risk" },
      { name: "--severity-low", value: "152 72% 44%", preview: "bg-severity-low", text: "text-severity-low", description: "Low risk" },
      { name: "--severity-info", value: "246 80% 68%", preview: "bg-severity-info", text: "text-severity-info", description: "Informational" },
    ],
  },
  {
    id: "status",
    label: "Status",
    icon: Sun,
    tokens: [
      { name: "--status-success", value: "150 65% 44%", preview: "bg-status-success", text: "text-status-success", description: "Success / OK" },
      { name: "--status-warning", value: "36 90% 50%", preview: "bg-status-warning", text: "text-status-warning", description: "Warning / caution" },
      { name: "--status-error", value: "0 78% 54%", preview: "bg-destructive", text: "text-destructive", description: "Error / critical" },
    ],
  },
  {
    id: "chart",
    label: "Chart",
    icon: Hash,
    tokens: [
      { name: "--chart-1", value: "225 95% 68%", preview: "bg-chart-1", text: "", description: "Primary series" },
      { name: "--chart-2", value: "152 72% 44%", preview: "bg-chart-2", text: "", description: "Secondary series" },
      { name: "--chart-3", value: "42 92% 50%", preview: "bg-chart-3", text: "", description: "Tertiary series" },
      { name: "--chart-4", value: "0 84% 56%", preview: "bg-chart-4", text: "", description: "Quaternary series" },
      { name: "--chart-5", value: "286 65% 60%", preview: "bg-chart-5", text: "", description: "Quinary series" },
      { name: "--chart-6", value: "200 85% 55%", preview: "bg-chart-6", text: "", description: "Accent 1" },
      { name: "--chart-7", value: "340 85% 55%", preview: "bg-chart-7", text: "", description: "Accent 2" },
    ],
  },
];

const TYPOGRAPHY_SCALE = [
  { label: "text-xs / caption", className: "text-xs", sample: "10px · 1rem · tracking-wide" },
  { label: "text-sm / body-small", className: "text-sm", sample: "12px · 1.25rem" },
  { label: "text-base / body", className: "text-base", sample: "14px · 1.5rem" },
  { label: "text-lg / body-large", className: "text-lg", sample: "16px · 1.75rem" },
  { label: "text-xl / heading-6", className: "text-xl font-semibold", sample: "18px · 1.75rem · 600w" },
  { label: "text-2xl / heading-5", className: "text-2xl font-semibold tracking-tight", sample: "20px · 1.75rem · 600w" },
  { label: "text-3xl / heading-4", className: "text-3xl font-bold tracking-tight", sample: "24px · 2rem · 700w" },
];

const BRAND_CLASSES = [
  { className: "brand-text", usage: "text-brand — colored text" },
  { className: "brand-text-gradient", usage: "Gradient text effect" },
  { className: "brand-text-muted", usage: "Muted brand text" },
  { className: "brand-bg", usage: "Solid brand background" },
  { className: "brand-bg-subtle", usage: "10% opacity background" },
  { className: "brand-bg-muted", usage: "5% opacity background" },
  { className: "brand-border", usage: "25% opacity border" },
  { className: "brand-glow", usage: "Standard brand glow shadow" },
  { className: "brand-glow-lg", usage: "Large brand glow shadow" },
  { className: "brand-gradient-border", usage: "Gradient border effect" },
  { className: "brand-shimmer", usage: "Animated shimmer overlay" },
  { className: "glass", usage: "Glass-morphism panel" },
  { className: "surface-raised", usage: "Raised surface card" },
  { className: "surface-elevated", usage: "High elevation surface" },
  { className: "code", usage: "Inline code marker" },
];

const COMPONENT_PREVIEWS = [
  {
    name: "Badge Variants",
    preview: (
      <div className="flex flex-wrap gap-2">
        <Badge variant="default">Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="critical">Critical</Badge>
        <Badge variant="info">Info</Badge>
      </div>
    ),
  },
  {
    name: "Severity Badges",
    preview: (
      <div className="flex flex-wrap gap-2">
        <Badge variant="critical">CRITICAL</Badge>
        <Badge variant="warning">HIGH</Badge>
        <Badge variant="warning">MEDIUM</Badge>
        <Badge variant="success">LOW</Badge>
      </div>
    ),
  },
  {
    name: "Button Variants",
    preview: (
      <div className="flex flex-wrap gap-2">
        <Button variant="default" size="sm">Primary</Button>
        <Button variant="secondary" size="sm">Secondary</Button>
        <Button variant="outline" size="sm">Outline</Button>
        <Button variant="ghost" size="sm">Ghost</Button>
        <Button variant="destructive" size="sm">Destructive</Button>
      </div>
    ),
  },
];

/* ── Copy helper ───────────────────────────────────────────────────── */

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="ml-auto rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
      title="Copy value"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check className="h-3 w-3 text-status-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

/* ── Color Swatch ──────────────────────────────────────────────────── */

function ColorSwatch({ token }: { token: { name: string; value: string; preview: string; text: string; description: string } }) {
  return (
    <div className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/50">
      <div className={cn("h-10 w-10 shrink-0 rounded-lg ring-1 ring-inset ring-white/10", token.preview)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono text-foreground/80">{token.name}</code>
          <CopyButton value={token.value} />
        </div>
        <p className="text-[11px] text-muted-foreground">{token.description}</p>
        <p className="font-mono text-[10px] text-muted-foreground/60">hsl({token.value})</p>
      </div>
      {token.text && <span className={cn("shrink-0 font-mono text-[10px]", token.text)}>Aa</span>}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */

export default function DesignSystemPage() {
  const [openSection, setOpenSection] = useState<string | null>("brand");

  return (
    <div className="space-y-10 animate-fade-in-up">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl brand-bg-subtle brand-border">
            <LogoIcon size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ARTSA Design System</h1>
            <p className="text-sm text-muted-foreground">
              Design tokens, color palette, typography, and brand utilities
            </p>
          </div>
        </div>
        <Separator />
      </div>

      {/* ── Logo ───────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Logo</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="brand-gradient-border">
            <CardContent className="flex items-center justify-center p-8">
              <Logo iconOnly iconSize={48} />
            </CardContent>
            <div className="border-t border-border px-4 py-2">
              <p className="text-center font-mono text-[10px] text-muted-foreground">Icon only</p>
            </div>
          </Card>
          <Card className="brand-gradient-border">
            <CardContent className="flex items-center justify-center p-8">
              <Logo wordmarkOnly iconSize={28} />
            </CardContent>
            <div className="border-t border-border px-4 py-2">
              <p className="text-center font-mono text-[10px] text-muted-foreground">Wordmark only</p>
            </div>
          </Card>
          <Card className="brand-gradient-border">
            <CardContent className="flex items-center justify-center p-8">
              <Logo iconSize={32} />
            </CardContent>
            <div className="border-t border-border px-4 py-2">
              <p className="text-center font-mono text-[10px] text-muted-foreground">Full logo</p>
            </div>
          </Card>
        </div>
      </section>

      {/* ── Color Palette ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Color Palette</h2>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {TOKEN_SECTIONS.map((section) => {
            const isOpen = openSection === section.id;
            const Icon = section.icon;
            return (
              <Card key={section.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 p-4 text-left"
                  onClick={() => setOpenSection(isOpen ? null : section.id)}
                  aria-expanded={isOpen}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span className="text-sm font-medium">{section.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {section.tokens.length} tokens
                  </span>
                  <ChevronDown
                    className={cn(
                      "ml-auto h-4 w-4 text-muted-foreground transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5 border-t border-border px-2 pb-3 pt-2">
                        {section.tokens.map((t) => (
                          <ColorSwatch key={t.name} token={t} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Typography ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Typography</h2>
        <Card>
          <div className="divide-y divide-border">
            {TYPOGRAPHY_SCALE.map((t) => (
              <div key={t.label} className="flex items-center gap-4 px-5 py-3.5">
                <span className={cn("min-w-0 flex-1", t.className)}>The quick brown fox</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{t.label}</span>
                <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground/60 sm:inline">{t.sample}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* ── Brand Utility Classes ──────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Brand Utilities</h2>
        <Card>
          <ScrollArea className="max-h-96">
            <div className="divide-y divide-border p-1">
              {BRAND_CLASSES.map((b) => (
                <div key={b.className} className="flex items-center gap-3 px-4 py-2.5">
                  <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-brand">
                    .{b.className}
                  </code>
                  <span className="text-xs text-muted-foreground">{b.usage}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </section>

      {/* ── Component Previews ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Component Preview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {COMPONENT_PREVIEWS.map((c) => (
            <Card key={c.name}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">{c.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">{c.preview}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── CSS Variable Reference ─────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">CSS Variable Reference</h2>
        <Card>
          <ScrollArea className="max-h-80">
            <pre className="p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {`/* ── Usage ────────────────────────────────────────── */

/* In CSS */
.my-element {
  color: hsl(var(--brand));
  background: hsl(var(--severity-critical-subtle));
}

/* In Tailwind (arbitrary values) */
<div className="bg-[hsl(var(--severity-low-subtle))]" />

/* In Tailwind (configured tokens) */
<div className="bg-status-success text-status-success-foreground" />
<Badge variant="critical" />
<span className="text-severity-high" />

/* ── Brand Utilities (prebuilt classes) ──────────── */
<div className="brand-text">Colored text</div>
<div className="brand-bg-subtle brand-border">
  Subtle brand container
</div>
<div className="brand-gradient-border rounded-xl">
  Gradient border card
</div>
<div className="brand-shimmer rounded-lg">
  Shimmer animation overlay
</div>
<div className="glass">
  Glass-morphism panel
</div>
<div className="surface-raised">
  Elevated card surface
</div>`}
            </pre>
          </ScrollArea>
        </Card>
      </section>
    </div>
  );
}
