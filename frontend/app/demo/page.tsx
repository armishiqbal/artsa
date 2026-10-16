import { redirect } from "next/navigation";

export default function DemoPage() {
  redirect("/signup?returnTo=/command-center");
}

