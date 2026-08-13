"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  ShieldOff,
  Swords,
  FlaskConical,
  Ban,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchFromBackend } from "@/lib/api";
import { toast } from "@/lib/stores/toast";

interface IncidentActionsProps {
  hasActiveSessions: boolean;
}

interface ActionDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  endpoint: string;
  method: "POST" | "PUT";
  variant: "default" | "destructive" | "outline" | "secondary";
  description: string;
  requiresConfirmation?: boolean;
  disabled?: boolean;
}

export function IncidentActions({ hasActiveSessions }: IncidentActionsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const actions: ActionDef[] = [
    {
      id: "quarantine_all",
      label: "Quarantine All",
      icon: ShieldOff,
      endpoint: "/api/v1/containment/quarantine-all",
      method: "POST",
      variant: "destructive",
      description: "Quarantine all active high-risk sessions",
      disabled: !hasActiveSessions,
    },
    {
      id: "lockdown",
      label: "Lockdown",
      icon: Ban,
      endpoint: "/api/v1/containment/lockdown",
      method: "POST",
      variant: "destructive",
      description: "Halt all agent tool execution immediately",
      disabled: !hasActiveSessions,
    },
    {
      id: "wargame",
      label: "Launch Campaign",
      icon: Swords,
      endpoint: "/campaigns",
      method: "POST",
      variant: "default",
      description: "Start a new red-team campaign",
    },
    {
      id: "forensic_snapshot",
      label: "Forensic Snapshot",
      icon: FlaskConical,
      endpoint: "/api/v1/forensics/snapshot",
      method: "POST",
      variant: "outline",
      description: "Capture full forensic state for analysis",
      disabled: !hasActiveSessions,
    },
  ];

  const handleAction = async (action: ActionDef) => {
    if (action.id === "wargame") {
      window.location.href = "/campaigns";
      return;
    }

    setLoadingAction(action.id);
    try {
      const res = await fetchFromBackend(action.endpoint, {
        method: action.method,
        silent: true,
      });
      if (res) {
        toast(action.label, {
          description: `${action.description} — completed successfully.`,
          variant: "success",
        });
      }
    } catch {
      // silent — errors handled by fetchFromBackend
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut", delay: 0.08 }}
      className="flex flex-wrap items-center gap-2"
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
        <Shield className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline font-medium uppercase tracking-wide">Response</span>
      </div>
      {actions.map((action) => {
        const isLoading = loadingAction === action.id;
        const Icon = action.icon;

        return (
          <Button
            key={action.id}
            variant={action.variant}
            size="sm"
            disabled={action.disabled || isLoading}
            onClick={() => handleAction(action)}
            className={cn(
              "gap-1.5 font-mono text-xs transition-all",
              action.variant === "destructive" &&
                !action.disabled &&
                "hover:shadow-glow-sm hover:shadow-severity-critical/20"
            )}
            title={action.description}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Icon className="h-3.5 w-3.5" aria-hidden />
            )}
            <span className="hidden sm:inline">{action.label}</span>
          </Button>
        );
      })}
    </motion.div>
  );
}
