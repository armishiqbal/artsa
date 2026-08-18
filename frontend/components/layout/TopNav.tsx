"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Command, Building2, ChevronDown, Check, LogOut, Moon, Sun, UserCircle2 } from "lucide-react";
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
import { useRouter } from "next/navigation";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { useAuthStore } from "@/lib/stores/auth";
import { useTenantStore } from "@/lib/stores/tenant";
import { useTheme } from "@/lib/context/ThemeProvider";
import { isOidcEnabled } from "@/lib/oidc";
import { avatarIsEmoji, resolveAvatarSrc } from "@/lib/profile";
import { cn } from "@/lib/utils";

const ROLE_VARIANT: Record<string, "default" | "secondary" | "info" | "warning" | "success"> = {
  admin: "success",
  analyst: "info",
  redteam: "warning",
  readonly: "secondary",
};

export default function TopNav() {
  const router = useRouter();
  const [inboxOpen, setInboxOpen] = useState(false);
  const { alerts, loading, criticalCount } = useAlerts();
  const { apiOnline, wsConnected, apiGatewayStatus } = useConnection();
  const { identity, loading: authLoading } = useAuthRole();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const hasBearer = useAuthStore((s) => Boolean(s.bearerToken));
  const apiKey = useAuthStore((s) => s.apiKey);
  const storedUser = useAuthStore((s) => s.user);
  const { theme, toggleTheme } = useTheme();

  // Profile menu
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Tenant selector — selection lives in the tenant store so every API call
  // (X-Tenant-ID header) is scoped to the chosen org (WS-3.1).
  const [tenants, setTenants] = useState<{ id: string; name: string; slug: string; plan: string }[]>([]);
  const tenantId = useTenantStore((s) => s.tenantId);
  const setTenantId = useTenantStore((s) => s.setTenant);
  const [tenantOpen, setTenantOpen] = useState(false);
  const tenantRef = useRef<HTMLDivElement>(null);

  // Close any open dropdown when clicking outside it.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    fetchFromBackend<{ tenants?: { id: string; name: string; slug: string; plan: string }[]; current?: string }>(
      "/api/v1/settings/tenants",
      { silent: true }
    ).then((d) => {
      if (d?.tenants) setTenants(d.tenants);
      if (d?.current) setTenantId(d.current);
    });
  }, [setTenantId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tenantRef.current && !tenantRef.current.contains(e.target as Node)) {
        setTenantOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentTenantName = tenants.find((t) => t.id === tenantId)?.name ?? "Default Org";

  const statusLabel = formatTopNavConnectionLabel(apiOnline, wsConnected, apiGatewayStatus);

  // Profile: prefer the locally-stored session profile (survives reload), fall
  // back to whatever /config/me resolved (covers OIDC / fresh-load edge cases).
  const profileUser = storedUser ?? identity.user ?? null;
  const profileEmail = profileUser?.email ?? null;
  const profileDisplayName = profileUser?.display_name ?? null;
  const profileRole = profileUser?.role ?? identity.role ?? null;
  const profileAvatar = profileUser?.avatar ?? null;
  const profileInitials = (profileDisplayName || profileEmail || profileRole || "AR").slice(0, 2).toUpperCase();

  const showProfile = !authLoading && (hasBearer || Boolean(apiKey) || identity.authenticated);
  // Only surface the SSO "Sign in" button when the user is actually signed out —
  // otherwise an API-key or OIDC-authenticated user sees a misleading duplicate login.
  const showOidcLogin = isOidcEnabled() && !hasBearer && !showProfile;

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
          {showProfile && (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-1.5 rounded-full border border-border p-0.5 pr-1.5 transition-colors hover:bg-accent"
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
              >
                {avatarIsEmoji(profileAvatar) ? (
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm leading-none"
                    aria-hidden
                  >
                    {profileAvatar}
                  </span>
                ) : resolveAvatarSrc(profileAvatar) ? (
                  <span className="h-7 w-7 overflow-hidden rounded-full ring-1 ring-primary/20" aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveAvatarSrc(profileAvatar) ?? undefined}
                      alt={profileDisplayName ?? "Avatar"}
                      className="h-full w-full object-cover"
                    />
                  </span>
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {profileInitials}
                  </span>
                )}
                <ChevronDown
                  className={cn("h-3 w-3 text-muted-foreground transition-transform", profileOpen && "rotate-180")}
                />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-border bg-card shadow-lg z-50 py-1">
                  <div className="border-b border-border px-3 py-2.5">
                    {profileDisplayName && (
                      <p className="truncate text-sm font-medium">{profileDisplayName}</p>
                    )}
                    {profileEmail ? (
                      <p className="truncate text-xs text-muted-foreground">{profileEmail}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Signed in</p>
                    )}
                    {profileRole && (
                      <Badge
                        variant={ROLE_VARIANT[profileRole] ?? "secondary"}
                        className="mt-1.5 gap-1 font-mono text-[10px] uppercase"
                      >
                        {profileRole}
                      </Badge>
                    )}
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    <UserCircle2 className="h-4 w-4" aria-hidden />
                    Profile
                  </Link>
                  <button
                    onClick={() => {
                      clearAuth();
                      router.push("/login");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive transition-colors hover:bg-accent"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" aria-hidden />
            ) : (
              <Moon className="h-4 w-4" aria-hidden />
            )}
          </button>
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
                aria-haspopup="menu"
                aria-expanded={tenantOpen}
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
                        setTenantId(t.id);
                        setTenantOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent",
                        t.id === tenantId && "bg-primary/5 text-primary"
                      )}
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      <div className="text-left min-w-0">
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{t.plan}</p>
                      </div>
                      {t.id === tenantId && <Check className="h-4 w-4 ml-auto shrink-0" />}
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
