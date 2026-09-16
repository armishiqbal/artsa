"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserCircle2, LogIn } from "lucide-react";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { useAuthStore } from "@/lib/stores/auth";
import { AvatarVisual } from "@/components/profile/AvatarVisual";
import { isOidcEnabled } from "@/lib/oidc";
import { landingSignInHref } from "@/lib/authSession";
import { cn } from "@/lib/utils";

interface UserProfileMenuProps {
  onNavigate?: () => void;
  className?: string;
}

export function UserProfileMenu({ onNavigate, className }: UserProfileMenuProps) {
  const pathname = usePathname();
  const { identity, loading: authLoading } = useAuthRole();
  const hasBearer = useAuthStore((s) => Boolean(s.bearerToken));
  const apiKey = useAuthStore((s) => s.apiKey);
  const storedUser = useAuthStore((s) => s.user);

  // Profile resolution: prefer locally stored user, fallback to /config/me identity.
  const profileUser = storedUser ?? identity.user ?? null;
  const profileEmail = profileUser?.email ?? null;
  const profileDisplayName = profileUser?.display_name ?? null;
  const profileRole = profileUser?.role ?? identity.role ?? null;
  const profileAvatar = profileUser?.avatar ?? null;
  const profileInitials = (profileDisplayName || profileEmail || profileRole || "AR").slice(0, 2).toUpperCase();

  const showProfile = !authLoading && (hasBearer || Boolean(apiKey) || identity.authenticated);
  const showOidcLogin = isOidcEnabled() && !hasBearer && !showProfile;
  const isProfileActive = pathname === "/profile";

  if (authLoading) {
    return (
      <div className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 animate-pulse", className)}>
        <div className="h-8 w-8 shrink-0 rounded-full bg-muted" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-3.5 w-20 rounded bg-muted" />
          <div className="h-2.5 w-14 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!showProfile) {
    if (showOidcLogin) {
      return (
        <Link
          href={landingSignInHref()}
          onClick={onNavigate}
          className={cn(
            "flex w-full min-h-11 items-center gap-3 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          <LogIn className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>Sign in</span>
        </Link>
      );
    }

    return (
      <Link
        href="/get-started"
        onClick={onNavigate}
        className={cn(
          "flex w-full min-h-11 items-center gap-3 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <UserCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>Account</span>
      </Link>
    );
  }

  return (
    <Link
      href="/profile"
      onClick={onNavigate}
      aria-label="View account profile"
      aria-current={isProfileActive ? "page" : undefined}
      className={cn(
        "group flex w-full min-h-11 items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isProfileActive
          ? "bg-muted text-foreground font-medium"
          : "text-muted-foreground hover:bg-muted/25 hover:text-foreground/90",
        className
      )}
    >
      {/* Avatar */}
      <AvatarVisual
        avatar={profileAvatar}
        label={profileDisplayName || profileEmail || profileRole || "AR"}
        size="sm"
        className="rounded-full overflow-hidden"
      />

      {/* User / Account label */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground leading-tight">
          {profileDisplayName || "Account"}
        </p>
        <p className="truncate font-mono text-[11px] text-muted-foreground leading-tight mt-0.5">
          {profileEmail || (profileRole ? profileRole.toUpperCase() : "Account")}
        </p>
      </div>
    </Link>
  );
}
