import { redirect } from "next/navigation";

export default function CampaignDetailRedirect({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/red-team/monitor/${params.id}`);
}
