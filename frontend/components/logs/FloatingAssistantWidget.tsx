"use client";

import { useState } from "react";
import { MessageSquare, X, Send, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Message {
  sender: "user" | "bot";
  text: string;
}

export function FloatingAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hello! I am your ARTSA Security Copilot. You can ask me to analyze detected threats, query specific request IDs, or inspect containment policies.",
    },
  ]);

  const handleSend = (textToSend?: string) => {
    const q = (textToSend ?? input).trim();
    if (!q) return;

    const userMsg: Message = { sender: "user", text: q };
    let botReply = "Analyzing telemetry... All active policies are enforcing zero-trust containment.";

    const lower = q.toLowerCase();
    if (lower.includes("summarize") || lower.includes("threat")) {
      botReply =
        "Summary: 2 Prompt Injection vectors intercepted (KILL), 1 network exfiltration attempt blocked, and benign system telemetry verified without false positives.";
    } else if (lower.includes("policy") || lower.includes("rule")) {
      botReply =
        "Active policies: org-default (active), prompt-injection-shield (active), no-network-exfil (active). DefenderAgent hot-patched 1 containment rule in the latest round.";
    } else if (lower.includes("req_")) {
      botReply = `Request inspection: The evaluated request matched policy 'strict-containment' with risk score 88.0 and was safely isolated.`;
    }

    setMessages((prev) => [...prev, userMsg, { sender: "bot", text: botReply }]);
    if (!textToSend) setInput("");
  };

  return (
    <>
      {/* Floating launcher button at bottom-right (matching Screenshot 2) */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full bg-[#0a1b39] text-white shadow-xl transition-all duration-200 hover:scale-105 hover:bg-[#0e244d] dark:bg-blue-600 dark:hover:bg-blue-500",
            open && "rotate-90 scale-95"
          )}
          aria-label="Open AI Security Assistant"
          title="ARTSA Security Assistant"
        >
          {open ? (
            <X className="h-5 w-5" />
          ) : (
            <div className="relative">
              <MessageSquare className="h-6 w-6" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
          )}
        </button>
      </div>

      {/* Popover Assistant Window */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 flex h-[460px] w-[360px] flex-col rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in-50 slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/80 bg-[#0a1b39] px-4 py-3.5 text-white rounded-t-2xl dark:bg-muted">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                <Sparkles className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-xs font-semibold">ARTSA Security Copilot</h4>
                <p className="flex items-center gap-1 text-[10px] text-emerald-300">
                  <ShieldCheck className="h-3 w-3" /> Real-time active guard
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick suggestions */}
          <div className="border-b border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1.5">
              Quick Inquiries
            </p>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => handleSend("Summarize detected threats today")}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Summarize threats
              </button>
              <button
                type="button"
                onClick={() => handleSend("Check active containment rules")}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Active rules
              </button>
            </div>
          </div>

          {/* Message stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex",
                  m.sender === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                    m.sender === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-none"
                      : "bg-muted text-foreground rounded-tl-none border border-border/60"
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input field */}
          <div className="border-t border-border/80 p-2.5 bg-background rounded-b-2xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-1.5"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about logs, threats, policies..."
                className="h-8 text-xs flex-1"
              />
              <Button type="submit" size="icon" className="h-8 w-8 shrink-0">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
