"use client";

import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";
import { LiveIndicator } from "@/components/shared/LiveIndicator";
import { PartnerDeveloperHub } from "@/components/get-started/PartnerDeveloperHub";
import { useConnection } from "@/lib/context/ConnectionProvider";

export default function DeveloperApiSetupPage() {
  const { apiOnline } = useConnection();

  return (
    <PageStack>
      <PageHeader
        title="Partner API keys"
        description="Create a key, share it with a partner, and they protect their agents with ARTSA."
        icon={<KeyRound className="h-5 w-5" />}
        badge={
          <LiveIndicator
            connected={apiOnline}
            label={apiOnline ? "API online" : "API offline"}
            className="text-[10px]"
          />
        }
      />
      <PartnerDeveloperHub />
    </PageStack>
  );
}
