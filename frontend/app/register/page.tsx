"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authSignupHref } from "@/lib/authSession";

/** Legacy /register → /signup */
export default function RegisterRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(authSignupHref());
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white" data-theme="light">
      <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden />
    </div>
  );
}
