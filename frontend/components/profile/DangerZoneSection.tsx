"use client";

import { useState, useEffect } from "react";
import {
  AlertOctagon,
  LogOut,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth";
import { toast } from "@/lib/stores/toast";

export function DangerZoneSection() {
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && confirmAllOpen) {
        setConfirmAllOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmAllOpen]);

  const handleSignOutCurrent = () => {
    clearAuth();
    toast("Signed out", { description: "Your session was terminated." });
    router.replace("/");
  };

  const handleSignOutAll = async () => {
    setLoading(true);
    try {
      clearAuth();
      if (typeof window !== "undefined") {
        window.sessionStorage.clear();
        window.localStorage.removeItem("artsa-auth");
      }
      toast("All sessions cleared", { description: "You have been signed out of all devices." });
      setConfirmAllOpen(false);
      router.replace("/");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div role="tabpanel" id="panel-danger" aria-labelledby="tab-danger" className="space-y-6">
      <div className="rounded-2xl border border-destructive-border bg-destructive-subtle/20 p-6 shadow-xs">
        <div className="flex items-center gap-3 text-destructive">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/15">
            <AlertOctagon className="h-5 w-5 text-destructive" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-destructive">Danger Zone</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Destructive session termination and security credential revocation actions.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4 divide-y divide-border/60">
          {/* Action 1: Sign out current */}
          <div className="flex flex-col gap-3 pt-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-foreground">Sign Out Current Session</p>
              <p className="text-[11px] text-muted-foreground">
                Terminates this browser session and revokes access to the management console.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOutCurrent}
              className="shrink-0 gap-1.5 border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 shadow-xs text-xs font-semibold"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign Out
            </Button>
          </div>

          {/* Action 2: Sign out all & flush */}
          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-foreground">
                Revoke All Sessions & Purge Local Credentials
              </p>
              <p className="text-[11px] text-muted-foreground">
                Clears all stored tokens, cached credentials, and cryptographic session cookies.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmAllOpen(true)}
              className="shrink-0 gap-1.5 shadow-xs text-xs font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Revoke All & Purge
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmAllOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="danger-modal-title"
          aria-describedby="danger-modal-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-fade-in"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-destructive/40 bg-card p-6 shadow-elevated animate-scale-in">
            <button
              onClick={() => setConfirmAllOpen(false)}
              aria-label="Close confirmation dialog"
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 rounded-md"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-3 text-destructive">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <h4 id="danger-modal-title" className="text-base font-bold text-foreground">
                Confirm Credential Revocation
              </h4>
            </div>

            <p id="danger-modal-desc" className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to sign out and purge all local tokens? You will be redirected to the login screen and will need to re-authenticate.
            </p>

            <div className="mt-6 flex justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmAllOpen(false)}
                disabled={loading}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleSignOutAll}
                disabled={loading}
                className="gap-1.5 text-xs font-semibold"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                Confirm Purge
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
