import { AppShell } from "@/components/layout/AppShell";

/**
 * Authenticated app shell. Only pages under the (app) route group render the
 * sidebar / top nav / command palette — the login page (and other public
 * routes like /auth/callback) stay bare.
 */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
