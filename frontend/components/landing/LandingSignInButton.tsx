"use client";

import type { ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authLoginHref, authSignupHref } from "@/lib/authSession";
import { useLandingSignInOptional } from "./LandingSignInContext";

// Re-export for call sites that imported SignInOptions from context
export type { SignInOptions } from "@/lib/authSession";

type LandingSignInButtonProps = ComponentProps<typeof Button> & {
  signInOptions?: { returnTo?: string; mode?: "login" | "register" };
};

/** Opens the authentication modal in-place (no page scroll or redirect) when within LandingSignInProvider. */
export function LandingSignInButton({
  signInOptions,
  children,
  onClick,
  ...props
}: LandingSignInButtonProps) {
  const router = useRouter();
  const signInCtx = useLandingSignInOptional();

  return (
    <Button
      type="button"
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (signInCtx) {
          signInCtx.openSignIn(signInOptions);
        } else {
          const href =
            signInOptions?.mode === "register"
              ? authSignupHref({ returnTo: signInOptions.returnTo })
              : authLoginHref({ returnTo: signInOptions?.returnTo });
          router.push(href);
        }
      }}
    >
      {children}
    </Button>
  );
}
