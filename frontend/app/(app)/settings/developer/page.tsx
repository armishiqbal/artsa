"use client";

import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageStack } from "@/components/shared/PageStack";
import { LiveIndicator } from "@/components/shared/LiveIndicator";
import { CustomerApiHub } from "@/components/get-started/CustomerApiHub";
import { useConnection } from "@/lib/context/ConnectionProvider";

export default function DeveloperApiSetupPage() {
  const { apiOnline } = useConnection();

  return (
    <PageStack>
      <PageHeader
        title="Customer API keys"
        description="Create a key for a customer. They call ARTSA to protect their agents — you provide the service."
        icon={<KeyRound className="h-5 w-5" />}
        badge={
          <LiveIndicator
            connected={apiOnline}
            label={apiOnline ? "API online" : "API offline"}
            className="text-[10px]"
          />
        }
      />
      <CustomerApiHub />
    </PageStack>
  );
}
