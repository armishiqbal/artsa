"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

export interface SignInOptions {
  returnTo?: string;
  mode?: "login" | "register";
}

interface LandingSignInContextValue {
  open: boolean;
  returnTo: string;
  mode: "login" | "register";
  openSignIn: (options?: SignInOptions) => void;
  closeSignIn: () => void;
}

const LandingSignInContext = createContext<LandingSignInContextValue | null>(null);

export function LandingSignInProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [returnTo, setReturnTo] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");

  const closeSignIn = useCallback(() => {
    setOpen(false);
    if (typeof window !== "undefined" && window.location.search.includes("signin=1")) {
      const params = new URLSearchParams(window.location.search);
      params.delete("signin");
      params.delete("mode");
      params.delete("returnTo");
      const query = params.toString();
      router.replace(query ? `/?${query}` : "/");
    }
  }, [router]);

  const openSignIn = useCallback((options?: SignInOptions) => {
    setReturnTo(options?.returnTo?.startsWith("/") ? options.returnTo : "");
    setMode(options?.mode === "register" ? "register" : "login");
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({ open, returnTo, mode, openSignIn, closeSignIn }),
    [open, returnTo, mode, openSignIn, closeSignIn]
  );

  return (
    <LandingSignInContext.Provider value={value}>{children}</LandingSignInContext.Provider>
  );
}

export function useLandingSignIn() {
  const ctx = useContext(LandingSignInContext);
  if (!ctx) {
    throw new Error("useLandingSignIn must be used within LandingSignInProvider");
  }
  return ctx;
}

export function useLandingSignInOptional() {
  return useContext(LandingSignInContext);
}
