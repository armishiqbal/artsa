"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  UserCircle2,
  ShieldCheck,
  Loader2,
  Save,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  RefreshCw,
  Pencil,
  X,
  ImagePlus,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/lib/stores/toast";
import { authHeaders, buildHeaders, unwrapEnvelope } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { cn } from "@/lib/utils";
import {
  AVATAR_OPTIONS,
  ROLE_VARIANT,
  roleLabel,
  methodLabel,
  formatMemberSince,
  passwordStrength,
  avatarIsEmoji,
  resolveAvatarSrc,
} from "@/lib/profile";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB, mirrors the backend limit

interface Profile {
  email: string;
  role: string;
  display_name: string;
  avatar?: string | null;
  phone?: string | null;
  location?: string | null;
  organization?: string | null;
  created_at: string | null;
}

interface SessionResponse {
  access_token: string;
  expires_in?: number;
  user?: {
    email?: string | null;
    role?: string | null;
    display_name?: string | null;
    avatar?: string | null;
    phone?: string | null;
    location?: string | null;
    organization?: string | null;
  };
}

/** Renders an avatar as image / emoji / initials from a stored value. */
function AvatarVisual({
  avatar,
  label,
  size = "lg",
}: {
  avatar: string | null | undefined;
  label: string;
  size?: "lg" | "md";
}) {
  const src = resolveAvatarSrc(avatar);
  const isEmoji = avatarIsEmoji(avatar);
  const initials = (label || "AR").slice(0, 2).toUpperCase();
  const box = size === "lg" ? "h-20 w-20 rounded-2xl" : "h-12 w-12 rounded-xl";
  if (src) {
    return (
      <span className={cn("relative shrink-0 overflow-hidden ring-1 ring-primary/20", box)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="h-full w-full object-cover" />
      </span>
    );
  }
  if (isEmoji) {
    return (
      <span className={cn("flex shrink-0 items-center justify-center bg-primary/10 text-primary ring-1 ring-primary/20", box)}>
        <span className={cn("leading-none", size === "lg" ? "text-3xl" : "text-xl")}>{avatar}</span>
      </span>
    );
  }
  return (
    <span className={cn("flex shrink-0 items-center justify-center bg-primary/10 font-semibold text-primary ring-1 ring-primary/20", box)}>
      <span className={cn("leading-none", size === "lg" ? "text-2xl" : "text-sm")}>{initials}</span>
    </span>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="pr-10"
          aria-label={label}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function ProfilePage() {
  const setApiKey = useAuthStore((s) => s.setApiKey);
  const setSession = useAuthStore((s) => s.setSession);
  const storedUser = useAuthStore((s) => s.user);
  const { identity, loading: authLoading } = useAuthRole();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [organization, setOrganization] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState<{ file: File; preview: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadMe = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/backend/api/v1/auth/me`, { headers: buildHeaders() });
      const body = await res.json().catch(() => ({}));
      const unwrapped = unwrapEnvelope(body) as Profile | null;
      if (res.status === 401 || !unwrapped?.email) {
        // No local password account behind these credentials (API key / SSO).
        setProfile(null);
        setDisplayName("");
        setAvatar(null);
        setPhone("");
        setLocation("");
        setOrganization("");
        return;
      }
      setProfile(unwrapped);
      setDisplayName(unwrapped.display_name ?? "");
      setAvatar(unwrapped.avatar ?? null);
      setPhone(unwrapped.phone ?? "");
      setLocation(unwrapped.location ?? "");
      setOrganization(unwrapped.organization ?? "");
    } catch {
      setLoadError(true);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  // A password session is the only session type that can edit the profile.
  const hasPasswordSession = profile !== null;
  const showEditable = hasPasswordSession;

  const dirty = useMemo(() => {
    if (!profile) return false;
    return (
      displayName.trim() !== (profile.display_name ?? "") ||
      avatar !== profile.avatar ||
      phone.trim() !== (profile.phone ?? "") ||
      location.trim() !== (profile.location ?? "") ||
      organization.trim() !== (profile.organization ?? "") ||
      pendingAvatar !== null
    );
  }, [profile, displayName, avatar, phone, location, organization, pendingAvatar]);

  const clearPendingAvatar = useCallback(() => {
    setPendingAvatar((cur) => {
      if (cur?.preview) URL.revokeObjectURL(cur.preview);
      return null;
    });
  }, []);

  const resetEdits = () => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setAvatar(profile.avatar ?? null);
    setPhone(profile.phone ?? "");
    setLocation(profile.location ?? "");
    setOrganization(profile.organization ?? "");
    clearPendingAvatar();
  };

  const startEdit = () => {
    setEditing(true);
    // Focus the name field once it's mounted next render.
    requestAnimationFrame(() => document.getElementById("profile-display-name")?.focus());
  };

  const cancelEdit = () => {
    resetEdits();
    setEditing(false);
  };

  const strength = passwordStrength(newPassword);
  const passwordsMatch = !newPassword || !confirmPassword || newPassword === confirmPassword;

  const onSaveProfile = async () => {
    if (!profile) return;
    setSavingName(true);
    try {
      // 1) Upload a newly-picked image first — it returns the serving path.
      let avatarToSave = avatar;
      if (pendingAvatar) {
        const form = new FormData();
        form.append("file", pendingAvatar.file);
        const upRes = await fetch(`/api/backend/api/v1/auth/me/avatar`, {
          method: "POST",
          headers: authHeaders(),
          body: form,
        });
        const upBody = await upRes.json().catch(() => ({}));
        const up = unwrapEnvelope(upBody) as SessionResponse | Record<string, unknown> | null;
        if (upRes.ok && up && typeof up === "object" && "user" in up) {
          avatarToSave = (up as SessionResponse).user?.avatar ?? avatar;
        } else {
          const detail = (up as Record<string, unknown> | null)?.detail;
          toast("Avatar upload failed", {
            description: typeof detail === "string" ? detail : `Request failed (${upRes.status})`,
            variant: "error",
          });
          return;
        }
      }

      // 2) Save every field in one PATCH; the fresh token carries the profile.
      const res = await fetch(`/api/backend/api/v1/auth/me`, {
        method: "PATCH",
        headers: buildHeaders(),
        body: JSON.stringify({
          display_name: displayName.trim(),
          avatar: avatarToSave,
          phone: phone.trim(),
          location: location.trim(),
          organization: organization.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      const unwrapped = unwrapEnvelope(body) as SessionResponse | Record<string, unknown> | null;
      if (res.ok && unwrapped && typeof unwrapped === "object" && "access_token" in unwrapped) {
        const session = unwrapped as SessionResponse;
        // Fresh token carries the updated profile — store token + profile together.
        setApiKey(null);
        setSession({ access_token: session.access_token, expires_in: session.expires_in }, session.user);
        const savedAvatar = session.user?.avatar ?? avatarToSave;
        setProfile((p) =>
          p
            ? {
                ...p,
                display_name: session.user?.display_name ?? displayName,
                avatar: savedAvatar,
                phone: session.user?.phone ?? phone,
                location: session.user?.location ?? location,
                organization: session.user?.organization ?? organization,
              }
            : p
        );
        setAvatar(savedAvatar);
        clearPendingAvatar();
        toast("Profile updated", { description: "Your profile was saved." });
        setEditing(false);
      } else {
        const detail = (unwrapped as Record<string, unknown> | null)?.detail;
        toast("Couldn't update profile", {
          description: typeof detail === "string" ? detail : `Request failed (${res.status})`,
          variant: "error",
        });
      }
    } finally {
      setSavingName(false);
    }
  };

  const onChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast("Missing fields", { description: "Enter your current and new password.", variant: "error" });
      return;
    }
    if (newPassword.length < 8) {
      toast("Password too short", { description: "New password must be at least 8 characters.", variant: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("Passwords don't match", { description: "The new password and confirmation differ.", variant: "error" });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch(`/api/backend/api/v1/auth/me/password`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      const unwrapped = unwrapEnvelope(body) as Record<string, unknown> | null;
      if (res.ok && unwrapped?.status === "changed") {
        toast("Password changed", { description: "Use your new password next time you sign in." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const detail = unwrapped?.detail;
        toast("Password not changed", {
          description: typeof detail === "string" ? detail : `Request failed (${res.status})`,
          variant: "error",
        });
      }
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading || authLoading) {
    return <ProfileSkeleton />;
  }

  if (loadError) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Profile"
          description="Your account details, display name, avatar, and contact info."
          icon={<UserCircle2 className="h-5 w-5" />}
        />
        <DashboardCard
          title="Couldn't load your profile"
          description="We hit a network error while fetching your account details."
        >
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <RefreshCw className="h-5 w-5" aria-hidden />
            </div>
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              Check that the API is reachable, then try again. Your settings are unchanged.
            </p>
            <Button onClick={loadMe} className="shrink-0 gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden />
              Retry
            </Button>
          </div>
        </DashboardCard>
      </div>
    );
  }

  // ── Resolved identity (works for every auth method) ────────────────────
  const role = profile?.role ?? identity.role ?? "user";
  const method = profile ? "password" : identity.auth_method ?? "api_key";
  const displayNameValue = profile?.display_name ?? storedUser?.display_name ?? roleLabel(role);
  const email = profile?.email ?? storedUser?.email ?? null;
  const avatarValue = profile?.avatar ?? storedUser?.avatar ?? null;
  const memberSince = formatMemberSince(profile?.created_at ?? null);
  const initialsLabel = (editing ? displayName : displayNameValue) || email || role || "AR";

  // The header mirrors the in-progress selection live while editing.
  const displayAvatar = pendingAvatar?.preview ?? (editing ? avatar : avatarValue);
  const hasImageAvatar = pendingAvatar !== null || (avatar !== null && !avatarIsEmoji(avatar));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Profile"
        description="Your account details, display name, avatar, and password."
        icon={<UserCircle2 className="h-5 w-5" />}
      />

      <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
        <DashboardCard
          title="Account"
          description={
            showEditable
              ? "Who you are signed in as — email and role can't be changed here."
              : "Who you are signed in as."
          }
          badge={
            showEditable
              ? editing
                ? (
                    <Button size="sm" variant="ghost" onClick={cancelEdit} className="gap-1.5 text-muted-foreground">
                      <X className="h-3.5 w-3.5" aria-hidden />
                      Cancel
                    </Button>
                  )
                : (
                    <Button size="sm" variant="outline" onClick={startEdit} className="gap-1.5">
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      Edit profile
                    </Button>
                  )
              : undefined
          }
        >
          {/* Identity header */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <AvatarVisual avatar={displayAvatar} label={initialsLabel} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{displayNameValue}</h2>
                <Badge
                  variant={ROLE_VARIANT[role] ?? "secondary"}
                  className="gap-1 font-mono text-[10px] uppercase"
                >
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  {roleLabel(role)}
                </Badge>
              </div>
              {email ? (
                <p className="mt-1 truncate text-sm text-muted-foreground">{email}</p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  Authenticated via the {roleLabel(role)} role {methodLabel(method).toLowerCase()}.
                </p>
              )}
              {memberSince && <p className="mt-1 text-xs text-muted-foreground">Member since {memberSince}</p>}
            </div>
            <div className="shrink-0 text-xs text-muted-foreground sm:text-right">
              <p>Signed in as</p>
              <p className="mt-0.5 font-mono text-[11px]">{email ?? roleLabel(role)}</p>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Read-only details (view mode) */}
          {!editing && (
            <>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Display name</dt>
                  <dd className="mt-1 truncate text-sm font-medium text-foreground">{displayNameValue}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</dt>
                  <dd className="mt-1 truncate text-sm text-foreground">{email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Phone</dt>
                  <dd className="mt-1 truncate text-sm text-foreground">{profile?.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Location</dt>
                  <dd className="mt-1 truncate text-sm text-foreground">{profile?.location || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Organization</dt>
                  <dd className="mt-1 truncate text-sm text-foreground">{profile?.organization || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</dt>
                  <dd className="mt-1 text-sm text-foreground">{roleLabel(role)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Member since</dt>
                  <dd className="mt-1 text-sm text-foreground">{memberSince ?? "—"}</dd>
                </div>
              </dl>
              {showEditable && (
                <p className="mt-5 text-xs text-muted-foreground">
                  Use <span className="font-medium text-foreground">Edit profile</span> to change your display name,
                  avatar, or contact details.
                </p>
              )}
              {!showEditable && (
                <p className="mt-5 text-xs text-muted-foreground">
                  Display name and avatar are managed by the{" "}
                  <span className="font-medium text-foreground">{roleLabel(role)}</span> role.
                </p>
              )}
            </>
          )}

          {/* Edit form — shown only while editing a password session */}
          {showEditable && editing && (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Avatar</label>
                  <div className="mt-3 flex items-center gap-3">
                    <AvatarVisual avatar={displayAvatar} label={initialsLabel} size="md" />
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor="profile-avatar-upload"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                      >
                        <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                        {hasImageAvatar ? "Replace image" : "Upload image"}
                      </label>
                      <input
                        id="profile-avatar-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = ""; // allow re-selecting the same file
                          if (!file) return;
                          if (!file.type.startsWith("image/")) {
                            toast("Unsupported file", {
                              description: "Choose a PNG, JPEG, WebP, or GIF image.",
                              variant: "error",
                            });
                            return;
                          }
                          if (file.size > AVATAR_MAX_BYTES) {
                            toast("Image too large", {
                              description: "Avatar image must be 2 MB or smaller.",
                              variant: "error",
                            });
                            return;
                          }
                          setPendingAvatar({ file, preview: URL.createObjectURL(file) });
                        }}
                      />
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        PNG, JPEG, WebP, or GIF — up to 2 MB. Or pick a symbol below.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAvatar(null);
                        clearPendingAvatar();
                      }}
                      aria-label="Use initials as avatar"
                      aria-pressed={avatar === null && pendingAvatar === null}
                      className={cn(
                        "relative flex h-10 w-10 items-center justify-center rounded-full border text-xs font-semibold transition-all",
                        avatar === null && pendingAvatar === null
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                          : "border-border bg-muted/30 text-muted-foreground hover:scale-105 hover:border-primary/40"
                      )}
                    >
                      {initialsLabel.slice(0, 2).toUpperCase()}
                    </button>
                    {AVATAR_OPTIONS.map((emoji) => {
                      const selected = avatar === emoji && pendingAvatar === null;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setAvatar(emoji);
                            clearPendingAvatar();
                          }}
                          aria-label={`Avatar ${emoji}`}
                          aria-pressed={selected}
                          className={cn(
                            "relative flex h-10 w-10 items-center justify-center rounded-full border text-lg leading-none transition-all",
                            selected
                              ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                              : "border-border bg-muted/30 hover:scale-105 hover:border-primary/40"
                          )}
                        >
                          {emoji}
                          {selected && (
                            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3 w-3" aria-hidden />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">Choose a symbol or keep your initials.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor="profile-display-name">
                        Display name
                      </label>
                      <span className="text-[11px] tabular-nums text-muted-foreground">{displayName.length}/48</span>
                    </div>
                    <Input
                      id="profile-display-name"
                      value={displayName}
                      maxLength={48}
                      placeholder="How your name appears in the top bar"
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="mt-2"
                      aria-label="Display name"
                    />
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Shown in the top bar and session summaries.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="profile-phone">
                      Phone
                    </label>
                    <Input
                      id="profile-phone"
                      value={phone}
                      maxLength={255}
                      placeholder="+1 555 000 1234"
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-2"
                      autoComplete="tel"
                      aria-label="Phone"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="profile-location">
                      Location / address
                    </label>
                    <Input
                      id="profile-location"
                      value={location}
                      maxLength={255}
                      placeholder="City, state, or full address"
                      onChange={(e) => setLocation(e.target.value)}
                      className="mt-2"
                      autoComplete="street-address"
                      aria-label="Location"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="profile-organization">
                      Organization / team
                    </label>
                    <Input
                      id="profile-organization"
                      value={organization}
                      maxLength={255}
                      placeholder="Company or team name"
                      onChange={(e) => setOrganization(e.target.value)}
                      className="mt-2"
                      autoComplete="organization"
                      aria-label="Organization"
                    />
                  </div>
                </div>
              </div>

              {dirty && (
                <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
                  <Button onClick={onSaveProfile} disabled={savingName} className="gap-2">
                    {savingName ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Save className="h-4 w-4" aria-hidden />
                    )}
                    Save changes
                  </Button>
                  <Button variant="outline" onClick={resetEdits} disabled={savingName} className="gap-2">
                    Revert
                  </Button>
                </div>
              )}
              {dirty && <p className="text-[11px] text-severity-medium">You have unsaved changes.</p>}
            </div>
          )}
        </DashboardCard>

        {showEditable ? (
          <DashboardCard
            title="Change password"
            description="Enter your current password to set a new one."
          >
            <div className="grid grid-cols-1 gap-4">
              <PasswordField
                label="Current password"
                value={currentPassword}
                onChange={setCurrentPassword}
                visible={showCurrent}
                onToggle={() => setShowCurrent((v) => !v)}
                autoComplete="current-password"
              />
              <div>
                <PasswordField
                  label="New password"
                  value={newPassword}
                  onChange={setNewPassword}
                  visible={showNew}
                  onToggle={() => setShowNew((v) => !v)}
                  autoComplete="new-password"
                />
                {newPassword ? (
                  strength && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex flex-1 gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <span
                            key={i}
                            className={cn("h-1 flex-1 rounded-full", i <= strength.bars ? strength.bar : "bg-border")}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground">{strength.label}</span>
                    </div>
                  )
                ) : (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Use 8+ characters — mix uppercase, numbers, or symbols to strengthen it.
                  </p>
                )}
              </div>
              <PasswordField
                label="Confirm new password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                visible={showConfirm}
                onToggle={() => setShowConfirm((v) => !v)}
                autoComplete="new-password"
              />
              {!passwordsMatch && (
                <p className="-mt-2 text-[11px] text-severity-critical">Passwords don&apos;t match.</p>
              )}
              <div>
                <Button onClick={onChangePassword} disabled={savingPassword} className="gap-2">
                  {savingPassword ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <KeyRound className="h-4 w-4" aria-hidden />
                  )}
                  Change password
                </Button>
              </div>
            </div>
          </DashboardCard>
        ) : (
          <DashboardCard
            title="Account security"
            description="How this session is authenticated."
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <KeyRound className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  This session uses a{" "}
                  <span className="font-mono text-xs">{methodLabel(method).toLowerCase()}</span> credential for the{" "}
                  <span className="font-medium">{roleLabel(role)}</span> role — there&apos;s no local password to
                  change.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Display name, avatar, and contact details are set by the Administrator.
                </p>
              </div>
            </div>
          </DashboardCard>
        )}
      </div>
    </div>
  );
}
