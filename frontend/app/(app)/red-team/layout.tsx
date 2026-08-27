import { RedTeamShell } from "@/components/red-team/RedTeamShell";

export default function RedTeamLayout({ children }: { children: React.ReactNode }) {
  return <RedTeamShell>{children}</RedTeamShell>;
}
