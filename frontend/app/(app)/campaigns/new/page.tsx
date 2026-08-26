import { redirect } from "next/navigation";

/** New scan is a modal on /campaigns — keep this route as a deep-link redirect. */
export default function NewScanRedirectPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const q = new URLSearchParams();
  q.set("new", "1");
  const target = searchParams.target;
  const category = searchParams.category;
  if (typeof target === "string") q.set("target", target);
  if (typeof category === "string") q.set("category", category);
  redirect(`/campaigns?${q.toString()}`);
}
