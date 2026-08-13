import type { Metadata } from "next";
import { AdminGuard } from "@/components/AdminGuard";

export const metadata: Metadata = {
  title: "ARTSA Admin Console",
  description: "Platform administration — providers, policies, integrations, system",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
