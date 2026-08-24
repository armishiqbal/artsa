"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { authLoginHref, authSignupHref } from "@/lib/authSession";

type LandingSignInLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  signInOptions?: { returnTo?: string; mode?: "login" | "register" };
};

/** Link to dedicated /login or /signup page. */
export function LandingSignInLink({
  signInOptions,
  children,
  className,
  ...props
}: LandingSignInLinkProps) {
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
