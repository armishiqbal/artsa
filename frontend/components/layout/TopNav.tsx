"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Command, UserCircle2, Building2, ChevronDown, Check } from "lucide-react";
import { LogoIcon } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LiveIndicator } from "@/components/shared/LiveIndicator";
import { AlertsInbox } from "@/components/layout/AlertsInbox";
import MobileNav from "@/components/layout/MobileNav";
import { useAlerts } from "@/lib/hooks/useAlerts";
import { useConnection } from "@/lib/context/ConnectionProvider";
import { formatTopNavConnectionLabel } from "@/lib/connectionStatus";
import { fetchFromBackend } from "@/lib/api";
import Link from "next/link";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { useAuthStore } from "@/lib/stores/auth";
import { isOidcEnabled } from "@/lib/oidc";
import { cn } from "@/lib/utils";

const ROLE_VARIANT: Record<string, "default" | "secondary" | "info" | "warning" | "success"> = {
  admin: "success",
  analyst: "info",
  redteam: "warning",
  readonly: "secondary",
};

export default function TopNav() {
  const [inboxOpen, setInboxOpen] = useState(false);
  const { alerts, loading, criticalCount } = useAlerts();
  const { apiOnline, wsConnected, apiGatewayStatus } = useConnection();
  const { identity, loading: authLoading } = useAuthRole();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const hasBearer = useAuthStore((s) => Boolean(s.bearerToken));
  const showOidcLogin = isOidcEnabled() && !hasBearer;

  // Tenant selector
  const [tenants, setTenants] = useState<{ id: string; name: string; slug: string; plan: string }[]>([]);
  const [currentTenant, setCurrentTenant] = useState("default_tenant");
  const [tenantOpen, setTenantOpen] = useState(false);
  const tenantRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFromBackend<{ tenants?: { id: string; name: string; slug: string; plan: string }[]; current?: string }>(
      "/api/v1/settings/tenants",
      { silent: true }
    ).then((d) => {
      if (d?.tenants) setTenants(d.tenants);
      if (d?.current) setCurrentTenant(d.current);
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tenantRef.current && !tenantRef.current.contains(e.target as Node)) {
        setTenantOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentTenantName = tenants.find((t) => t.id === currentTenant)?.name ?? "Default Org";

  const statusLabel = formatTopNavConnectionLabel(apiOnline, wsConnected, apiGatewayStatus);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-6">
        <div className="flex items-center gap-2 lg:hidden">
          <MobileNav />
          <span className="font-semibold tracking-tight">ARTSA</span>
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <LiveIndicator connected={apiOnline} label={statusLabel} className="hidden sm:inline-flex" />
          <kbd className="hidden items-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground md:inline-flex">
            <Command className="h-3 w-3" aria-hidden />
            K
          </kbd>
        </div>

        <div className="flex items-center gap-2">
          {showOidcLogin && (
            <Button asChild variant="outline" size="sm" className="hidden text-xs sm:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
          {hasBearer && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden text-xs text-muted-foreground sm:inline-flex"
              onClick={() => {
                clearAuth();
                window.location.reload();
              }}
            >
              Sign out
            </Button>
          )}
          {!authLoading && (
            <Badge
              variant={ROLE_VARIANT[identity.role] ?? "secondary"}
              className={cn("hidden gap-1 font-mono text-[10px] uppercase sm:inline-flex")}
            >
              <UserCircle2 className="h-3 w-3" aria-hidden />
              {identity.role}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 font-mono text-xs"
            aria-label="View alerts"
            aria-expanded={inboxOpen}
            onClick={() => setInboxOpen(true)}
          >
            <Bell className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="hidden sm:inline">Alerts</span>
            {criticalCount > 0 && (
              <Badge variant="critical" className="h-5 min-w-5 justify-center px-1.5 text-[10px]">
                {criticalCount}
              </Badge>
            )}
          </Button>
          <div className="hidden items-center gap-2 border-l border-border pl-3 text-xs text-muted-foreground md:flex" ref={tenantRef}>
            <LogoIcon size={14} className="text-status-success" aria-hidden />
            <div className="relative">
              <button
                onClick={() => setTenantOpen(!tenantOpen)}
                className="flex items-center gap-1 font-mono text-xs hover:text-foreground transition-colors"
              >
                {currentTenantName}
                <ChevronDown className={cn("h-3 w-3 transition-transform", tenantOpen && "rotate-180")} />
              </button>
              {tenantOpen && tenants.length > 0 && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-card shadow-lg z-50 py-1">
                  {tenants.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setCurrentTenant(t.id);
                        setTenantOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent",
                        t.id === currentTenant && "bg-primary/5 text-primary"
                      )}
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      <div className="text-left min-w-0">
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{t.plan}</p>
                      </div>
                      {t.id === currentTenant && <Check className="h-4 w-4 ml-auto shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <AlertsInbox
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        alerts={alerts}
        loading={loading}
      />
    </>
  );
}
