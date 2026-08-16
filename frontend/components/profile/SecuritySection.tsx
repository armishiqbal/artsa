"use client";

import { useState } from "react";
import {
  KeyRound,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { passwordStrength, roleLabel, methodLabel } from "@/lib/profile";
import { SecurityAuditStream } from "@/components/profile/SecurityAuditStream";
import { cn } from "@/lib/utils";
import type { Profile } from "./types";

interface SecuritySectionProps {
  profile: Profile | null;
  role: string;
  method: string;
  showEditable: boolean;
  currentPassword: string;
  setCurrentPassword: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  savingPassword: boolean;
  onChangePassword: () => Promise<void>;
  oidcEnabled?: boolean;
}

export function SecuritySection({
  profile,
  role,
  method,
  showEditable,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  savingPassword,
  onChangePassword,
  oidcEnabled = false,
}: SecuritySectionProps) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = passwordStrength(newPassword);
  const passwordsMatch = !newPassword || !confirmPassword || newPassword === confirmPassword;

  return (
    <div role="tabpanel" id="panel-security" aria-labelledby="tab-security" className="space-y-6">
      {/* Account Sign-In Summary */}
      <DashboardCard
        title="Sign-In & Protection"
        description="Overview of how your account is authenticated."
        icon={<Lock className="h-4 w-4 text-primary" aria-hidden="true" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Card 1: Sign-In Method */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
            <span className="text-xs font-semibold text-muted-foreground">Sign-In Method</span>
            <div className="mt-2 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">
                  {showEditable ? "Password Account" : `${roleLabel(role)} Key`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {showEditable ? "Email & Password login" : "Direct access key"}
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Account Protection Status */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
            <span className="text-xs font-semibold text-muted-foreground">Account Status</span>
            <div className="mt-2 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-status-success/15 text-status-success">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Active & Protected</p>
                <p className="text-[11px] text-muted-foreground">
                  {oidcEnabled ? "Managed via Enterprise SSO" : "Secure session link"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DashboardCard>

      {/* Change Password Card */}
      {showEditable ? (
        <DashboardCard
          title="Change Password"
          description="Update your password to keep your account secure."
          icon={<KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (currentPassword && newPassword && passwordsMatch && !savingPassword) {
                onChangePassword();
              }
            }}
            className="max-w-md space-y-4"
          >
            {/* Current Password */}
            <div>
              <label
                htmlFor="current-password-input"
                className="text-xs font-semibold text-foreground"
              >
                Current Password <span className="text-primary">*</span>
              </label>
              <div className="relative mt-1.5">
                <Input
                  id="current-password-input"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter current password"
                  className="pr-10 shadow-xs text-xs"
                  aria-required="true"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  aria-label={showCurrent ? "Hide password text" : "Show password text"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="new-password-input"
                  className="text-xs font-semibold text-foreground"
                >
                  New Password <span className="text-primary">*</span>
                </label>
                {strength && (
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Strength: <strong className="text-foreground">{strength.label}</strong>
                  </span>
                )}
              </div>
              <div className="relative mt-1.5">
                <Input
                  id="new-password-input"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="pr-10 shadow-xs text-xs"
                  aria-required="true"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  aria-label={showNew ? "Hide password text" : "Show password text"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {showNew ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {newPassword ? (
                strength && (
                  <div
                    className="mt-2 flex items-center gap-1.5"
                    role="progressbar"
                    aria-valuenow={strength.bars * 25}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Password strength: ${strength.label}`}
                  >
                    {[1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-1.5 flex-1 rounded-full transition-all",
                          i <= strength.bars ? strength.bar : "bg-border"
                        )}
                      />
                    ))}
                  </div>
                )
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Use 8+ characters combining uppercase, numbers, and symbols.
                </p>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label
                htmlFor="confirm-password-input"
                className="text-xs font-semibold text-foreground"
              >
                Confirm New Password <span className="text-primary">*</span>
              </label>
              <div className="relative mt-1.5">
                <Input
                  id="confirm-password-input"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Re-type new password"
                  className="pr-10 shadow-xs text-xs"
                  aria-required="true"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? "Hide password text" : "Show password text"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>

              {!passwordsMatch && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-severity-critical" role="alert">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> Passwords do not match.
                </p>
              )}
            </div>

            <div className="pt-1">
              <Button
                type="submit"
                disabled={savingPassword || !currentPassword || !newPassword || !passwordsMatch}
                className="gap-2 shadow-xs text-xs font-semibold"
              >
                {savingPassword ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Save New Password
              </Button>
            </div>
          </form>
        </DashboardCard>
      ) : (
        <DashboardCard
          title="Role Key Access"
          description="Information about your active role key."
          icon={<KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />}
        >
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              This session uses a static role key (<code>X-API-Key</code>). Password management is only needed for personal user accounts.
            </p>
          </div>
        </DashboardCard>
      )}

      {/* Recent Security Activity Stream */}
      <SecurityAuditStream />
    </div>
  );
}
