"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { authLoginHref, authSignupHref } from "@/lib/authSession";
import { useLandingSignInOptional } from "./LandingSignInContext";

type LandingSignInLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  signInOptions?: { returnTo?: string; mode?: "login" | "register" };
};

/** Opens the authentication modal in-place when within LandingSignInProvider, or links to dedicated /login or /signup. */
export function LandingSignInLink({
  signInOptions,
  children,
  className,
  ...props
}: LandingSignInLinkProps) {
  const signInCtx = useLandingSignInOptional();

  if (signInCtx) {
    return (
      <button
        type="button"
        className={className}
        onClick={(e) => {
          e.preventDefault();
          signInCtx.openSignIn(signInOptions);
        }}
      >
        {children}
      </button>
    );
  }

  const href =
    signInOptions?.mode === "register"
      ? authSignupHref({ returnTo: signInOptions.returnTo })
      : authLoginHref({ returnTo: signInOptions?.returnTo });

  return (
    <Link href={href} className={className} {...props}>
      {children}
    </Link>
  );
}
