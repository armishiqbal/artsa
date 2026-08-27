import { redirect } from "next/navigation";

export default function NewCampaignRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const q = new URLSearchParams();
  const target = searchParams.target;
  const category = searchParams.category;
  if (typeof target === "string") q.set("target", target);
  if (typeof category === "string") q.set("category", category);
  const qs = q.toString();
  redirect(qs ? `/red-team/campaigns/new?${qs}` : "/red-team/campaigns/new");
}
