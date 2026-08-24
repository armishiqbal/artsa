"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface LandingContactContextValue {
  open: boolean;
  openContactSales: () => void;
  closeContactSales: () => void;
}

const LandingContactContext = createContext<LandingContactContextValue | null>(null);

export function LandingContactProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openContactSales = useCallback(() => setOpen(true), []);
  const closeContactSales = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, openContactSales, closeContactSales }),
    [open, openContactSales, closeContactSales]
  );

  return (
    <LandingContactContext.Provider value={value}>{children}</LandingContactContext.Provider>
  );
}

export function useLandingContact() {
  const ctx = useContext(LandingContactContext);
  if (!ctx) {
    throw new Error("useLandingContact must be used within LandingContactProvider");
  }
  return ctx;
}

export function useLandingContactOptional() {
  return useContext(LandingContactContext);
}
