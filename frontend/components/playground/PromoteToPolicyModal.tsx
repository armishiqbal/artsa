"use client";

import React from "react";
import { X, ShieldPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromoteToPlaybookPanel } from "@/components/wargame/PromoteToPlaybookPanel";
import type { AdversarialPreset } from "@/lib/playgroundAdversarialPresets";

interface PromoteToPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  preset?: AdversarialPreset | null;
  customPrompt?: string;
  onSuccess?: () => void;
}

export function PromoteToPolicyModal({
  isOpen,
  onClose,
  preset,
  customPrompt,
  onSuccess,
}: PromoteToPolicyModalProps) {
  if (!isOpen) return null;

  const promptText = preset?.prompt || customPrompt || "";
  const title = preset?.title || "Adversarial Probe Finding";
  const severity = preset?.severity || "HIGH";
  const category = preset?.category || "Prompt Attack";

  const findingSource = {
    content: promptText,
    title,
    severity,
    category,
    asiCode: preset?.owasp || "OWASP LLM01",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="promote-policy-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in-50"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700 border border-sky-200">
              <ShieldPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 id="promote-policy-title" className="text-base font-semibold text-slate-900">
                Deploy Defense Policy Hotpatch
              </h2>
              <p className="text-xs text-slate-500">
                Generate and enforce a deterministic firewall rule to block this attack vector
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200/80">
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
              <span className="font-semibold">{title}</span>
              <span className="font-mono text-[10px] uppercase font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                {severity}
              </span>
            </div>
            <p className="font-mono text-xs text-slate-800 line-clamp-3 bg-white p-2 rounded border border-slate-200/60">
              {promptText}
            </p>
          </div>

          <PromoteToPlaybookPanel
            findingSource={findingSource}
            onPromoted={() => {
              onSuccess?.();
            }}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
