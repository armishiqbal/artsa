"use client";

import { Code2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";
import { LiveIndicator } from "@/components/shared/LiveIndicator";
import { LakeraDeveloperHub } from "@/components/get-started/LakeraDeveloperHub";
import { useConnection } from "@/lib/context/ConnectionProvider";

export default function DeveloperApiSetupPage() {
  const { apiOnline } = useConnection();

  return (
    <PageStack>
      <PageHeader
        title="Developer Quickstart & API Setup"
        description="Connect your AI agents to ARTSA with API keys and drop-in code snippets."
        icon={<Code2 className="h-5 w-5" />}
        badge={
          <LiveIndicator
            connected={apiOnline}
            label={apiOnline ? "Gateway Live" : "Offline Fallback"}
            className="text-[10px]"
          />
        }
      />
      <LakeraDeveloperHub />
    </PageStack>
  );
}
