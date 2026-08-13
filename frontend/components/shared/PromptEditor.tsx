"use client";

import { useRef, useCallback, useEffect, type TextareaHTMLAttributes } from "react";

/**
 * A textarea with syntax highlighting overlay for prompt injection / jailbreak keywords.
 * Renders a transparent textarea on top of a pre element that shows highlighted tokens.
 * Keywords: system red-teaming terms, injection markers, roleplay triggers, etc.
 */
const KEYWORD_PATTERNS: Array<{ regex: RegExp; className: string }> = [
  { regex: /\b(system|assistant|user|human|developer)\b/gi, className: "text-violet-400 font-semibold" },
  { regex: /\b(ignore|disregard|override|bypass|forget|pretend|imagine)\b/gi, className: "text-rose-400 font-semibold" },
  { regex: /\b(DAN|GPT|Claude|LLM|AI|chatbot|model)\b/gi, className: "text-status-warning font-semibold" },
  { regex: /\b(instructions?|prompt|directive|rule|policy|guideline|constraint)\b/gi, className: "text-sky-400" },
  { regex: /\b(never|always|must|should|can'?t|don'?t|cannot)\b/gi, className: "text-orange-400" },
  { regex: /\b(reveal|expose|extract|leak|disclose|output|print|say|tell|write|show)\b/gi, className: "text-status-success" },
  { regex: /\b(harmful|malicious|dangerous|illegal|unethical|toxic|unsafe)\b/gi, className: "text-red-400" },
  { regex: /\b(jailbreak|injection|exploit|attack|payload|adversarial|red.team)\b/gi, className: "text-fuchsia-400 font-semibold" },
  { regex: /(```[\s\S]*?```|`[^`]*`)/g, className: "text-cyan-400" },
  { regex: /(["']["'].*?["'"])/g, className: "text-yellow-300" },
];

interface PromptEditorProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export default function PromptEditor({ label, className = "", ...props }: PromptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  useEffect(() => {
    syncScroll();
  });

  const value = (props.value as string) ?? "";

  const highlightText = (text: string): React.ReactNode[] => {
    if (!text) return [];

    // Find all matches with positions
    interface Match {
      start: number;
      end: number;
      className: string;
    }
    const matches: Match[] = [];
    for (const { regex, className: cn } of KEYWORD_PATTERNS) {
      let m: RegExpExecArray | null;
      regex.lastIndex = 0;
      while ((m = regex.exec(text)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, className: cn });
      }
    }

    // Sort and deduplicate overlapping (first wins)
    matches.sort((a, b) => a.start - b.start);
    const deduped: Match[] = [];
    let lastEnd = 0;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        deduped.push(m);
        lastEnd = m.end;
      }
    }

    // Build spans
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    for (const m of deduped) {
      if (m.start > cursor) {
        nodes.push(<span key={`t-${cursor}`}>{text.slice(cursor, m.start)}</span>);
      }
      nodes.push(
        <span key={`h-${m.start}`} className={m.className}>
          {text.slice(m.start, m.end)}
        </span>
      );
      cursor = m.end;
    }
    if (cursor < text.length) {
      nodes.push(<span key={`t-${cursor}`}>{text.slice(cursor)}</span>);
    }

    return nodes;
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}
      <div className="relative">
        {/* Highlighted overlay */}
        <pre
          ref={preRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-md border border-transparent bg-transparent px-3 py-2 font-mono text-xs leading-relaxed"
        >
          <code>{highlightText(value)}</code>
        </pre>
        {/* Transparent textarea for input */}
        <textarea
          ref={textareaRef}
          onScroll={syncScroll}
          className={`w-full rounded-md border bg-background/80 px-3 py-2 font-mono text-xs leading-relaxed text-transparent caret-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring resize-y ${className}`}
          spellCheck={false}
          {...props}
        />
      </div>
    </div>
  );
}
