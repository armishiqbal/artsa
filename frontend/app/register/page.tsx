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
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
      <Loader2 className="h-6 w-6 animate-spin text-[#a7a7a7]" aria-hidden />
    </div>
  );
}
