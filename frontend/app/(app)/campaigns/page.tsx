import { redirect } from "next/navigation";

/** Legacy Wargame hub → Red Team campaigns. */
export default function CampaignsRedirectPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const q = new URLSearchParams();
  if (searchParams.new) q.set("new", "1");
  const target = searchParams.target;
  const category = searchParams.category;
  if (typeof target === "string") q.set("target", target);
  if (typeof category === "string") q.set("category", category);
  const qs = q.toString();
  redirect(qs ? `/red-team/campaigns?${qs}` : "/red-team/campaigns");
}
