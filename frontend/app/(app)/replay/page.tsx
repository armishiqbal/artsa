import { redirect } from "next/navigation";

export default function ReplayRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = searchParams.session;
  if (typeof session === "string") {
    redirect(`/red-team/evidence?session=${encodeURIComponent(session)}`);
  }
  redirect("/red-team/evidence");
}
