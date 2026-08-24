import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in · ARTSA",
  description: "Sign in to your ARTSA workspace",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
