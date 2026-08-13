import { redirect } from "next/navigation";

/**
 * Root route (/) redirects to the Command Center dashboard.
 * Legacy URL — kept as a 301-equivalent via Next.js server redirect.
 * The next.config.js redirects also handle this at the edge level.
 */
export default function RootPage() {
  redirect("/dashboard");
}
