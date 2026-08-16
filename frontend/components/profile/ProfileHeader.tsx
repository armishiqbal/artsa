"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Building2,
  MapPin,
  Calendar,
  KeyRound,
  Pencil,
  X,
  Copy,
  Check,
  Shield,
  CircleDot,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvatarVisual } from "@/components/profile/AvatarVisual";
import {
  ROLE_VARIANT,
  roleLabel,
  methodLabel,
  formatMemberSince,
} from "@/lib/profile";
import { toast } from "@/lib/stores/toast";
import type { Profile } from "./types";

interface ProfileHeaderProps {
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

export function ProfileHeader({
  profile,
  role,
  method,
  displayNameValue,
  email,
  displayAvatar,
  initialsLabel,
  showEditable,
  editing,
  onStartEdit,
  onCancelEdit,
  tenantName = "Default Organization",
}: ProfileHeaderProps) {
  const [copied, setCopied] = useState(false);
  const memberSince = formatMemberSince(profile?.created_at ?? null);
  const orgName = profile?.organization || tenantName;
  const location = profile?.location;

  const copyEmail = async () => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      toast("Email copied", { description: email });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Copy failed", { variant: "error" });
    }
  };

  return (
    <div className="relative rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        {/* Left: Avatar & Identity details */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center min-w-0">
          <AvatarVisual
            avatar={displayAvatar}
            label={initialsLabel}
            size="xl"
            showStatusIndicator
            statusOnline
          />

          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl truncate">
                {displayNameValue}
              </h1>

              <Badge
                variant={ROLE_VARIANT[role] ?? "secondary"}
                className="gap-1 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider shadow-xs"
              >
                <ShieldCheck className="h-3 w-3" aria-hidden />
                {roleLabel(role)}
              </Badge>

              <Badge
                variant="outline"
                className="gap-1 border-border bg-muted/30 font-mono text-[10px] text-muted-foreground"
              >
                <CircleDot className="h-2.5 w-2.5 text-status-success fill-status-success" />
                Active Session
              </Badge>
            </div>

            {/* Email with copy button */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {email ? (
                <button
                  type="button"
                  onClick={copyEmail}
                  className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono transition-colors hover:bg-muted hover:text-foreground"
                  title="Click to copy email"
                >
                  <span>{email}</span>
                  {copied ? (
                    <Check className="h-3 w-3 text-status-success" aria-hidden />
                  ) : (
                    <Copy className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" aria-hidden />
                  )}
                </button>
              ) : (
                <span>Authenticated via {roleLabel(role)} credentials</span>
              )}

              <span className="text-border">·</span>

              <span className="inline-flex items-center gap-1">
                <KeyRound className="h-3 w-3 text-muted-foreground" aria-hidden />
                {methodLabel(method)}
              </span>
            </div>

            {/* Meta badges row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs text-muted-foreground">
              {orgName && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <span>{orgName}</span>
                </div>
              )}
              {location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <span>{location}</span>
                </div>
              )}
              {memberSince && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <span>Member since {memberSince}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick actions */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {showEditable && (
            <div>
              {editing ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onCancelEdit}
                  className="gap-1.5 border-border bg-background shadow-xs hover:bg-muted text-xs"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Cancel
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onStartEdit}
                  className="gap-1.5 shadow-xs text-xs"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit Profile
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
