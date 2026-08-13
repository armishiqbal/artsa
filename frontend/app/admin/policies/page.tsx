"use client";

import { useEffect, useState } from "react";
import { Shield, Plus, Trash2 } from "lucide-react";
import { fetchFromBackend } from "@/lib/api";
import { useAuthRole } from "@/lib/hooks/useAuthRole";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface PolicyRule {
  name: string;
  pattern: string;
  event_type: string;
  severity: string;
  risk_score: number;
  description: string;
}

export default function PoliciesPage() {
  const { capabilities, loading: authLoading } = useAuthRole();
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [draft, setDraft] = useState<PolicyRule>({
    name: "",
    pattern: "",
    event_type: "SANDBOX_ESCAPE",
    severity: "HIGH",
    risk_score: 75,
    description: "",
  });
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetchFromBackend<{ rules?: PolicyRule[] }>("/api/v1/policies", { silent: true }).then((data) => {
      if (data?.rules) setRules(data.rules);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const saveAll = async () => {
    setSaving(true);
    await fetchFromBackend("/api/v1/policies", {
      method: "PUT",
      body: JSON.stringify({ rules }),
    });
    setSaving(false);
    load();
  };

  const addRule = async () => {
    if (!draft.name || !draft.pattern) return;
    await fetchFromBackend("/api/v1/policies/rules", {
      method: "POST",
      body: JSON.stringify(draft),
    });
    setDraft({ name: "", pattern: "", event_type: "SANDBOX_ESCAPE", severity: "HIGH", risk_score: 75, description: "" });
    load();
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  if (!authLoading && !capabilities.can_manage_policies) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Org Policies"
          description="Custom detection rules backed by YAML — evaluated by the containment engine."
          icon={<Shield className="h-5 w-5" />}
        />
        <EmptyState
          icon={Shield}
          title="Policy management restricted"
          description="Your role does not include permission to view or edit organization policies."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Org Policies"
        description="Custom detection rules backed by YAML — evaluated by the containment engine."
        icon={<Shield className="h-5 w-5" />}
        actions={
          <Button size="sm" onClick={saveAll} disabled={saving}>
            {saving ? "Saving…" : "Save all"}
          </Button>
        }
      />

      <DashboardCard title="Add Rule" badge={<Badge variant="secondary">{rules.length} active</Badge>}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input placeholder="Rule name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input placeholder="Regex pattern" value={draft.pattern} onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} className="font-mono" />
          <Input placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="md:col-span-2" />
        </div>
        <Button size="sm" className="mt-3 gap-2" onClick={addRule}>
          <Plus className="h-4 w-4" />
          Add rule
        </Button>
      </DashboardCard>

      <div className="space-y-3">
        {rules.map((rule, i) => (
          <DashboardCard key={`${rule.name}-${i}`} title={rule.name} badge={<Badge variant={rule.severity === "CRITICAL" ? "critical" : "warning"}>{rule.severity}</Badge>}>
            <p className="font-mono text-xs text-muted-foreground">/{rule.pattern}/</p>
            <p className="mt-2 text-sm text-muted-foreground">{rule.description || rule.event_type}</p>
            <div className="mt-3 flex items-center justify-between">
              <RiskScoreInline score={rule.risk_score} />
              <Button variant="ghost" size="sm" onClick={() => removeRule(i)} aria-label={`Remove ${rule.name}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </DashboardCard>
        ))}
      </div>
    </div>
  );
}

function RiskScoreInline({ score }: { score: number }) {
  return <span className="font-mono text-xs text-muted-foreground">Risk threshold: {score}</span>;
}
