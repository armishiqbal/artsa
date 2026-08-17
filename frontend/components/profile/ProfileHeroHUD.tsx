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
  CheckCircle2,
  Sparkles,
  Camera,
  Shield,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvatarVisual } from "@/components/profile/AvatarVisual";
import {
  ROLE_VARIANT,
  roleLabel,
  formatMemberSince,
} from "@/lib/profile";
import { toast } from "@/lib/stores/toast";
import { cn } from "@/lib/utils";
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

  // Calculate profile completion percentage
  const fields = [
    Boolean(displayNameValue),
    Boolean(email),
    Boolean(profile?.avatar || displayAvatar),
    Boolean(profile?.phone),
    Boolean(profile?.location),
    Boolean(profile?.organization),
  ];
  const completedFields = fields.filter(Boolean).length;
  const completionPercentage = Math.round((completedFields / fields.length) * 100);

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
    <section aria-labelledby="profile-overview-heading" className="relative">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card via-card to-card/90 p-6 sm:p-7 shadow-sm transition-all duration-300">
        {/* Subtle Brand Accent Light Glow */}
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          {/* Left: Avatar with Status Ring & Executive Info */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center min-w-0">
            <div className="relative group shrink-0">
              <div className="rounded-2xl p-1 bg-gradient-to-tr from-primary/30 via-border to-border/40 shadow-xs">
                <AvatarVisual
                  avatar={displayAvatar}
                  label={initialsLabel}
                  size="xl"
                  showStatusIndicator
                  statusOnline
                />
              </div>

              {showEditable && !editing && (
                <button
                  type="button"
                  onClick={onStartEdit}
                  aria-label="Change profile photo"
                  className="absolute inset-1 flex items-center justify-center rounded-2xl bg-black/50 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 backdrop-blur-[2px]"
                >
                  <Camera className="h-5 w-5 text-white" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1
                  id="profile-overview-heading"
                  className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate"
                >
                  {displayNameValue}
                </h1>

                <Badge
                  variant={ROLE_VARIANT[role] ?? "secondary"}
                  className="px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase font-mono shadow-xs border"
                >
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  {roleLabel(role)}
                </Badge>

                <span className="inline-flex items-center gap-1 rounded-full border border-status-success/40 bg-status-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-status-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" />
                  Verified Active
                </span>
              </div>

              {/* Email with 1-click copy */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {email ? (
                  <button
                    type="button"
                    onClick={copyEmail}
                    className="group inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1 font-mono text-xs transition-all hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Copy email: ${email}`}
                    title="Click to copy email address"
                  >
                    <span className="font-semibold text-foreground">{email}</span>
                    {copied ? (
                      <span className="flex items-center gap-1 text-status-success font-sans font-bold">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Copied
                      </span>
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
                    )}
                  </button>
                ) : (
                  <span>Signed in as {roleLabel(role)}</span>
                )}
              </div>

              {/* Metadata Badges Row */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-xs text-muted-foreground">
                {orgName && (
                  <div className="flex items-center gap-1.5 rounded-md bg-muted/30 px-2 py-0.5 border border-border/50">
                    <Building2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    <span className="font-medium text-foreground">{orgName}</span>
                  </div>
                )}
                {location && (
                  <div className="flex items-center gap-1.5 rounded-md bg-muted/30 px-2 py-0.5 border border-border/50">
                    <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    <span>{location}</span>
                  </div>
                )}
                {memberSince && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Member since {memberSince}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Profile Setup Progress & Primary Edit Button */}
          <div className="flex flex-wrap items-center gap-3.5 shrink-0">
            {/* Completion Meter */}
            <div className="flex items-center gap-3 rounded-xl border border-border/90 bg-muted/30 px-3.5 py-2 shadow-xs">
              <div className="relative flex h-8 w-8 items-center justify-center">
                <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-border/60"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-primary transition-all duration-700 ease-out"
                    strokeDasharray={`${completionPercentage}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute font-mono text-[10px] font-bold text-foreground">
                  {completionPercentage}%
                </span>
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-foreground leading-tight">Account Health</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {completionPercentage === 100 ? "Optimal" : `${completionPercentage}% Complete`}
                </p>
              </div>
            </div>

            {/* Primary Action Button */}
            {showEditable && (
              <div>
                {editing ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onCancelEdit}
                    className="h-9 gap-1.5 border-border bg-card shadow-xs hover:bg-muted text-xs font-semibold"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Done Editing
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={onStartEdit}
                    className="h-9 gap-1.5 shadow-sm text-xs font-bold transition-all hover:scale-[1.02]"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit Profile
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
