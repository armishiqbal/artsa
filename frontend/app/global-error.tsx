"use client";

import { ErrorPage } from "@/components/shared/ErrorPage";

/**
 * Root global error boundary — the last line of defense. Because it may fire
 * while the root layout itself is failing, it renders its own <html>/<body>
 * and a minimal style sheet rather than depending on the app shell.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" className="dark">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "hsl(222 24% 4.5%)", color: "hsl(30 18% 96%)", fontFamily: "system-ui, sans-serif" }}>
        <ErrorPage
          title="ARTSA encountered a critical error"
          description="Something broke at the app level. Reloading usually fixes it."
          onReset={reset}
        />
      </body>
    </html>
  );
}
