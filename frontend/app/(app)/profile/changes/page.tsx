import { redirect } from "next/navigation";

export default function ProfileChangesRoute() {
  redirect("/profile?tab=changes");
}
