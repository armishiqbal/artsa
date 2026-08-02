"use client";

import { ConnectionProvider } from "@/lib/context/ConnectionProvider";
import { Toaster } from "@/components/ui/toaster";
import { AuthHydrator } from "@/components/AuthHydrator";
import { AuthGuard } from "@/components/AuthGuard";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConnectionProvider>
      <AuthHydrator />
      <AuthGuard>{children}</AuthGuard>
      <Toaster />
    </ConnectionProvider>
  );
}
