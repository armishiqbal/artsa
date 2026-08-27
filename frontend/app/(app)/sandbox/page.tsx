import { redirect } from "next/navigation";

export default function SandboxRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const q = new URLSearchParams();
  for (const key of ["case", "template", "user"] as const) {
    const v = searchParams[key];
    if (typeof v === "string") q.set(key, v);
  }
  const qs = q.toString();
  redirect(qs ? `/red-team/lab?${qs}` : "/red-team/lab");
}
