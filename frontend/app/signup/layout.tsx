import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up · ARTSA",
  description: "Create your ARTSA workspace",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
