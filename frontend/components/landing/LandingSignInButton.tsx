"use client";

import type { ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authLoginHref, authSignupHref, type SignInOptions } from "@/lib/authSession";

// Re-export for call sites that imported SignInOptions from context
export type { SignInOptions } from "@/lib/authSession";

type LandingSignInButtonProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  signInOptions?: { returnTo?: string; mode?: "login" | "register" };
};

/** Navigates to the dedicated /login or /signup page (no popup). */
export function LandingSignInButton({
  signInOptions,
  children,
  ...props
}: LandingSignInButtonProps) {
  const router = useRouter();

  return (
    <Button
      type="button"
      {...props}
      onClick={(e) => {
        e.preventDefault();
        const href =
          signInOptions?.mode === "register"
            ? authSignupHref({ returnTo: signInOptions.returnTo })
            : authLoginHref({ returnTo: signInOptions?.returnTo });
        router.push(href);
      }}
    >
      {children}
    </Button>
  );
}
