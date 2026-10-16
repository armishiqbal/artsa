"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Lock, LogIn, Mail, UserPlus, X } from "lucide-react";
import { LogoIcon } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { easeOut } from "@/lib/motionPresets";
import {
  type AuthResponse,
  type AuthStatus,
  postAuth,
  RETURN_TO_KEY,
} from "@/lib/authSession";
import { unwrapEnvelope } from "@/lib/api";
import { isOidcEnabled, startOidcLogin } from "@/lib/oidc";
import { useAuthStore } from "@/lib/stores/auth";

interface LandingSignInPanelProps {
  open: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
  returnTo?: string;
  onContactSales?: () => void;
}

export function LandingSignInPanel({
  open,
  onClose,
  initialMode = "login",
  returnTo = "",
  onContactSales,
}: LandingSignInPanelProps) {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const dest = returnTo.startsWith("/") ? returnTo : "/command-center";

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setError(null);
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/backend/api/v1/auth/status")
      .then((res) => res.json())
      .then((raw) => {
        if (cancelled) return;
        const status = unwrapEnvelope(raw) as AuthStatus;
        const regOpen = Boolean(status?.registration_open);
        setRegistrationOpen(regOpen);
        if (regOpen && initialMode === "register") setMode("register");
        else if (!regOpen) setMode("login");
      })
      .catch(() => {
        if (!cancelled) setRegistrationOpen(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, initialMode]);

  const finishWithSession = (session: AuthResponse) => {
    setSession({ access_token: session.access_token, expires_in: session.expires_in }, session.user);
    router.replace(dest);
  };

  const handlePasswordLogin = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await postAuth("/api/v1/auth/login", { email: email.trim(), password });
      finishWithSession(session);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid email or password.";
      setError(
        message === "Invalid email or password" ? "Incorrect email or password." : message
      );
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await postAuth("/api/v1/auth/register", {
        email: email.trim(),
        password,
        display_name: displayName.trim(),
      });
      finishWithSession(session);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      if (message.toLowerCase().includes("registration is closed")) {
        setRegistrationOpen(false);
        setMode("login");
        setError("An admin account already exists. Sign in with that email and password.");
      } else if (message.toLowerCase().includes("already exists")) {
        setMode("login");
        setError("That email already has an account. Sign in instead.");
      } else {
        setError(message);
      }
      setLoading(false);
    }
  };

  const handleSsoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      sessionStorage.setItem(RETURN_TO_KEY, dest);
      const redirectUri = `${window.location.origin}/auth/callback`;
      await startOidcLogin(redirectUri);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start SSO login");
      setLoading(false);
    }
  };

  const isRegister = mode === "register" && registrationOpen !== false;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: easeOut }}
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close sign in"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="landing-signin-title"
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl text-slate-900"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.35, ease: easeOut }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>

            <div className="flex flex-col items-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
                <LogoIcon size={28} aria-hidden />
              </div>
              <h2
                id="landing-signin-title"
                className="text-2xl font-bold tracking-tight text-slate-900"
              >
                {isRegister ? "Create the admin account" : "Sign in to ARTSA"}
              </h2>
              <p className="mt-2 text-center text-sm text-slate-600">
                {isRegister
                  ? "The first account becomes administrator and unlocks admin features."
                  : "Sign in with your admin email and password."}
              </p>

              <div className="mt-6 w-full space-y-3">
                <div className="relative">
                  <Mail
                    className="absolute left-3.5 top-3 h-4 w-4 text-slate-400"
                    aria-hidden
                  />
                  <Input
                    type="email"
                    placeholder="admin@artsa.ai"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      if (isRegister) handleRegister();
                      else handlePasswordLogin();
                    }}
                    className="pl-10 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-600 shadow-2xs h-11"
                    aria-label="Email"
                  />
                </div>
                {isRegister && (
                  <Input
                    type="text"
                    placeholder="Display name (optional)"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-600 shadow-2xs h-11"
                    aria-label="Display name"
                  />
                )}
                <div className="relative">
                  <Lock
                    className="absolute left-3.5 top-3 h-4 w-4 text-slate-400"
                    aria-hidden
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      if (isRegister) handleRegister();
                      else handlePasswordLogin();
                    }}
                    className="pl-10 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-600 shadow-2xs h-11"
                    aria-label="Password"
                  />
                </div>
                <Button
                  size="lg"
                  onClick={isRegister ? handleRegister : handlePasswordLogin}
                  disabled={loading}
                  className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 h-11 shadow-md gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : isRegister ? (
                    <UserPlus className="h-4 w-4" aria-hidden />
                  ) : (
                    <LogIn className="h-4 w-4" aria-hidden />
                  )}
                  {isRegister ? "Create admin account" : "Sign in"}
                </Button>
                {registrationOpen !== false ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode(isRegister ? "login" : "register");
                      setError(null);
                    }}
                    className="w-full text-center text-xs font-medium text-slate-600 hover:text-blue-600 hover:underline pt-1"
                  >
                    {isRegister
                      ? "Already have an account? Sign in"
                      : "First time? Create the admin account"}
                  </button>
                ) : (
                  <p className="text-center text-xs text-slate-500">
                    Registration is closed. Sign in as the existing admin.
                  </p>
                )}
              </div>

              {isOidcEnabled() && (
                <div className="mt-5 w-full">
                  <p className="mb-2 text-center text-xs uppercase tracking-wider text-slate-400 font-mono">
                    or continue with
                  </p>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full gap-2 rounded-xl border-slate-300 bg-white text-slate-800 hover:bg-slate-50 shadow-xs h-11"
                    onClick={handleSsoLogin}
                    disabled={loading}
                  >
                    <LogIn className="h-4 w-4 text-blue-600" aria-hidden />
                    Organization SSO
                  </Button>
                </div>
              )}

              <div className="mt-5 w-full">
                <p className="mb-2 text-center text-xs text-slate-500">
                  New deployment?{" "}
                  <Link href="/signup" className="font-semibold text-blue-600 underline-offset-4 hover:underline" onClick={onClose}>
                    Create workspace
                  </Link>
                </p>
              </div>

              {error ? <p className="mt-3 text-xs font-semibold text-rose-600 text-center">{error}</p> : null}

              {onContactSales ? (
                <p className="mt-4 text-center text-xs text-slate-500">
                  Evaluating for your enterprise?{" "}
                  <button
                    type="button"
                    className="font-semibold text-blue-600 underline-offset-4 hover:underline"
                    onClick={() => {
                      onClose();
                      onContactSales();
                    }}
                  >
                    Schedule architecture review
                  </button>
                </p>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
