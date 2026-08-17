"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Globe,
  Sliders,
  Volume2,
  VolumeX,
} from "lucide-react";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/utils";

export function PreferencesSection() {
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [audioChime, setAudioChime] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  // Live user local timezone
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short",
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div role="tabpanel" id="panel-preferences" aria-labelledby="tab-preferences" className="space-y-6">
      {/* Interactive Alert Toggles */}
      <DashboardCard
        title="Alert & Notification Preferences"
        description="Configure what notifications you receive during agent containment and evaluations."
        icon={<Bell className="h-4 w-4 text-primary" aria-hidden="true" />}
      >
        <div className="space-y-3.5 max-w-xl">
          {/* Critical Alerts Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card p-4 text-xs shadow-xs">
            <div className="space-y-0.5 pr-4">
              <p className="text-xs font-bold text-foreground">Critical Breach Alerts</p>
              <p className="text-[11px] text-muted-foreground">
                Display high-priority notifications when an agent trigger is quarantined.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={criticalAlerts}
              onClick={() => {
                setCriticalAlerts(!criticalAlerts);
                toast(criticalAlerts ? "Alerts muted" : "Alerts enabled");
              }}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                criticalAlerts ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-xs transition duration-200",
                  criticalAlerts ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {/* Sound Chimes Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card p-4 text-xs shadow-xs">
            <div className="space-y-0.5 pr-4">
              <p className="text-xs font-bold text-foreground">Audio Notifications</p>
              <p className="text-[11px] text-muted-foreground">
                Play an audible alert tone when a critical risk threshold is exceeded.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={audioChime}
              onClick={() => {
                setAudioChime(!audioChime);
                toast(audioChime ? "Sound muted" : "Sound enabled");
              }}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                audioChime ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-xs transition duration-200",
                  audioChime ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      </DashboardCard>

      {/* Localization Card with Live Clock */}
      <DashboardCard
        title="Localization & Regional Time"
        description="Automatic timezone detection and audit timestamp formatting."
        icon={<Globe className="h-4 w-4 text-primary" aria-hidden="true" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-xl">
          <div className="rounded-xl border border-border/80 bg-card p-4 text-xs shadow-xs">
            <span className="font-semibold text-muted-foreground">Language</span>
            <p className="mt-1.5 font-bold text-foreground">English (US)</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Default platform language</p>
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-4 text-xs shadow-xs">
            <span className="font-semibold text-muted-foreground">Your Local Time</span>
            <p className="mt-1.5 font-mono font-bold text-primary">
              {currentTime || "Detecting..."}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Auto-synchronized with browser</p>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
