"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authLoginHref, authSignupHref } from "@/lib/authSession";

/**
 * Legacy ?signin=1 deep links → dedicated /login or /signup pages.
 * Kept so old bookmarks and e2e still resolve.
 */
function SignInRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("signin") !== "1") return;
    const returnTo = searchParams.get("returnTo") || undefined;
    const mode = searchParams.get("mode");
    const href =
      mode === "register" ? authSignupHref({ returnTo }) : authLoginHref({ returnTo });
    router.replace(href);
  }, [searchParams, router]);

  return null;
}

export function LandingSignInRoot({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <SignInRedirectInner />
      </Suspense>
    </>
  );
}

export function LandingSignInModal() {
  return null;
}
