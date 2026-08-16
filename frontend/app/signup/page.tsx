"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SignupRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login?mode=register");
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
    </div>
  );
}
