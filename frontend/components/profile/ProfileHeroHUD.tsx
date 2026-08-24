"use client";

import { useState } from "react";
import {
  Building2,
  MapPin,
  Calendar,
  Pencil,
  X,
  Copy,
  Check,
  Camera,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvatarVisual } from "@/components/profile/AvatarVisual";
import { ROLE_VARIANT, roleLabel, formatMemberSince } from "@/lib/profile";
import { toast } from "@/lib/stores/toast";
import type { Profile } from "./types";

interface ProfileHeroHUDProps {
  profile: Profile | null;
  role: string;
  method: string;
  displayNameValue: string;
  email: string | null;
  displayAvatar: string | null;
  initialsLabel: string;
  showEditable: boolean;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  tenantName?: string;
}

export function ProfileHeroHUD({
  profile,
  role,
  displayNameValue,
  email,
  displayAvatar,
  initialsLabel,
  showEditable,
  editing,
  onStartEdit,
  onCancelEdit,
  tenantName = "Default Organization",
}: ProfileHeroHUDProps) {
  const [copied, setCopied] = useState(false);
  const memberSince = formatMemberSince(profile?.created_at ?? null);
  const orgName = profile?.organization || tenantName;
  const location = profile?.location;

  const copyEmail = async () => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      toast("Email copied to clipboard", { description: email });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Copy failed", { variant: "error" });
    }
  };

  return (
    <section aria-labelledby="profile-overview-heading" className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative group shrink-0">
            <AvatarVisual
              avatar={displayAvatar}
              label={initialsLabel}
              size="xl"
              showStatusIndicator
              statusOnline
            />
            {showEditable && !editing && (
              <button
                type="button"
                onClick={onStartEdit}
                aria-label="Change profile photo"
                className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Camera className="h-5 w-5" aria-hidden />
              </button>
            )}
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                id="profile-overview-heading"
                className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
              >
                {displayNameValue}
              </h1>
              <Badge variant={ROLE_VARIANT[role] ?? "secondary"} className="font-mono text-[10px] uppercase">
                {roleLabel(role)}
              </Badge>
            </div>

            {email ? (
              <button
                type="button"
                onClick={copyEmail}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15"
                aria-label={`Copy email: ${email}`}
              >
                {email}
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-status-success" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">Signed in as {roleLabel(role)}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {orgName && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" aria-hidden />
                  {orgName}
                </span>
              )}
              {location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {location}
                </span>
              )}
              {memberSince && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" aria-hidden />
                  Member since {memberSince}
                </span>
              )}
            </div>
          </div>
        </div>

        {showEditable && (
          <div className="shrink-0">
            {editing ? (
              <Button size="sm" variant="outline" onClick={onCancelEdit}>
                <X className="h-3.5 w-3.5" aria-hidden />
                Done
              </Button>
            ) : (
              <Button size="sm" onClick={onStartEdit}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit profile
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
