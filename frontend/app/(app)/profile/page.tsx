"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  UserCircle2,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/stores/toast";
import { authHeaders, buildHeaders, unwrapEnvelope, fetchFromBackend } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { isOidcEnabled } from "@/lib/oidc";
import { roleLabel, parseAvatarValue } from "@/lib/profile";

import { ProfileHeroHUD } from "@/components/profile/ProfileHeroHUD";
import { ProfileSidebarNav, type ProfileTabKey } from "@/components/profile/ProfileSidebarNav";
import { SecurityHealthCard } from "@/components/profile/SecurityHealthCard";
import { PersonalInfoSection } from "@/components/profile/PersonalInfoSection";
import { SecuritySection } from "@/components/profile/SecuritySection";
import { PreferencesSection } from "@/components/profile/PreferencesSection";
import { CredentialsSection } from "@/components/profile/CredentialsSection";
import type { Profile, SessionResponse, TenantInfo } from "@/components/profile/types";

function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto" aria-busy="true" aria-label="Loading profile">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-4">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
        <div className="lg:col-span-8">
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
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
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("general");

  // Profile data states
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [organization, setOrganization] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState<{ file: File; preview: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [savingName, setSavingName] = useState(false);

  // Password management states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Tenant metadata state
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);

  const loadMe = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/backend/api/v1/auth/me`, { headers: buildHeaders() });
      const body = await res.json().catch(() => ({}));
      const unwrapped = unwrapEnvelope(body) as Profile | null;
      if (res.status === 401 || !unwrapped?.email) {
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

  const loadTenants = useCallback(async () => {
    try {
      const data = await fetchFromBackend<{ tenants?: TenantInfo[]; current?: string }>(
        "/api/v1/settings/tenants",
        { silent: true }
      );
      if (data?.tenants && data.tenants.length > 0) {
        const cur = data.tenants.find((t) => t.id === data.current) || data.tenants[0];
        setTenantInfo(cur);
      }
    } catch {
      // Non-blocking fallback
    }
  }, []);

  useEffect(() => {
    loadMe();
    loadTenants();
  }, [loadMe, loadTenants]);

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
    setActiveTab("general");
    setEditing(true);
    requestAnimationFrame(() => document.getElementById("profile-display-name")?.focus());
  };

  const cancelEdit = () => {
    resetEdits();
    setEditing(false);
  };

  const onSaveProfile = async () => {
    if (!profile) return;
    setSavingName(true);
    try {
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
          const uploadedPath = (up as SessionResponse).user?.avatar;
          const colorTag = parseAvatarValue(avatar).colorId;
          avatarToSave = uploadedPath ? `${uploadedPath}#${colorTag}` : avatar;
        } else {
          const detail = (up as Record<string, unknown> | null)?.detail;
          toast("Avatar upload failed", {
            description: typeof detail === "string" ? detail : `Request failed (${upRes.status})`,
            variant: "error",
          });
          return;
        }
      }

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
        toast("Profile saved", { description: "Your details have been updated." });
        setEditing(false);
      } else {
        const detail = (unwrapped as Record<string, unknown> | null)?.detail;
        toast("Update failed", {
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
      toast("Missing fields", { description: "Enter both current and new password.", variant: "error" });
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
        toast("Password updated", { description: "Use your new password next time you sign in." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const detail = unwrapped?.detail;
        toast("Password update failed", {
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
      <div className="space-y-6 animate-fade-in max-w-6xl mx-auto" role="alert">
        <PageHeader
          title="Account Profile"
          description="Manage your profile info, password, and preferences."
          icon={<UserCircle2 className="h-5 w-5" aria-hidden="true" />}
        />
        <DashboardCard
          title="Service Unavailable"
          description="Could not load your account profile from the backend API."
        >
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              Please check that ARTSA is running and reachable, then refresh.
            </p>
            <Button onClick={loadMe} className="shrink-0 gap-2 text-xs">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry Connection
            </Button>
          </div>
        </DashboardCard>
      </div>
    );
  }

  // Identity resolution
  const role = profile?.role ?? identity.role ?? "user";
  const method = profile ? "password" : identity.auth_method ?? "api_key";
  const displayNameValue = profile?.display_name ?? storedUser?.display_name ?? roleLabel(role);
  const email = profile?.email ?? storedUser?.email ?? null;
  const avatarValue = profile?.avatar ?? storedUser?.avatar ?? null;
  const initialsLabel = (editing ? displayName : displayNameValue) || email || role || "AR";

  // Build displayAvatar carrying the active color tag
  const currentAvatarVal = editing ? avatar : avatarValue;
  const parsedActiveColor = parseAvatarValue(currentAvatarVal).colorId;
  const displayAvatar = pendingAvatar
    ? `${pendingAvatar.preview}#${parsedActiveColor}`
    : currentAvatarVal;

  const oidcActive = isOidcEnabled();

  return (
    <main className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-12" aria-label="Account Settings">
      <PageHeader
        title="Account Profile"
        description="Manage your personal info, password, visual preferences, and API credentials."
        icon={<UserCircle2 className="h-5 w-5" aria-hidden="true" />}
      />

      {/* Top Friendly Identity Card */}
      <ProfileHeroHUD
        profile={profile}
        role={role}
        method={method}
        displayNameValue={displayNameValue}
        email={email}
        displayAvatar={displayAvatar}
        initialsLabel={initialsLabel}
        showEditable={showEditable}
        editing={editing}
        onStartEdit={startEdit}
        onCancelEdit={cancelEdit}
        tenantName={tenantInfo?.name || "Default Organization"}
      />

      {/* Two-Column Clean Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Navigation & Friendly Checklist */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-4" aria-label="Profile navigation">
          <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-xs">
            <div className="px-2 py-1.5 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Settings
            </div>
            <ProfileSidebarNav
              activeTab={activeTab}
              onSelectTab={(tab) => {
                setActiveTab(tab);
                if (tab !== "general" && editing) {
                  setEditing(false);
                }
              }}
            />
          </div>

          {/* Profile Completion Checklist */}
          <SecurityHealthCard
            profile={profile}
            role={role}
            hasPasswordSession={hasPasswordSession}
            onNavigateTab={(tab) => {
              setActiveTab(tab);
              if (tab !== "general" && editing) {
                setEditing(false);
              }
            }}
          />
        </aside>

        {/* Right Active Content Area */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6" aria-live="polite">
          {activeTab === "general" && (
            <PersonalInfoSection
              profile={profile}
              role={role}
              email={email}
              displayName={displayName}
              setDisplayName={setDisplayName}
              avatar={avatar}
              setAvatar={setAvatar}
              phone={phone}
              setPhone={setPhone}
              location={location}
              setLocation={setLocation}
              organization={organization}
              setOrganization={setOrganization}
              pendingAvatar={pendingAvatar}
              setPendingAvatar={setPendingAvatar}
              clearPendingAvatar={clearPendingAvatar}
              showEditable={showEditable}
              editing={editing}
              setEditing={setEditing}
              dirty={dirty}
              savingName={savingName}
              onSaveProfile={onSaveProfile}
              onResetEdits={resetEdits}
              initialsLabel={initialsLabel}
              displayAvatar={displayAvatar}
            />
          )}

          {activeTab === "security" && (
            <SecuritySection
              profile={profile}
              role={role}
              method={method}
              showEditable={showEditable}
              currentPassword={currentPassword}
              setCurrentPassword={setCurrentPassword}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              savingPassword={savingPassword}
              onChangePassword={onChangePassword}
              oidcEnabled={oidcActive}
            />
          )}

          {activeTab === "preferences" && <PreferencesSection />}

          {activeTab === "developer" && <CredentialsSection />}
        </div>
      </div>
    </main>
  );
}
