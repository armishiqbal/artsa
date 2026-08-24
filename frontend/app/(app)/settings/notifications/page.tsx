"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  BellRing,
  Mail,
  Loader2,
  CheckCircle2,
  Send,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchFromBackend, unwrapEnvelope } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardCard } from "@/components/shared/DashboardCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/stores/toast";

interface NotificationPrefs {
  email_digest_enabled: boolean;
  email_digest_frequency: string;
  email_recipients: string[];
  slack_enabled: boolean;
  slack_webhook_url: string;
  slack_channel: string;
  slack_dm_on_critical: boolean;
  pagerduty_enabled: boolean;
  pagerduty_routing_key: string;
  pagerduty_severity_threshold: string;
  splunk_enabled: boolean;
  splunk_hec_url: string;
  splunk_hec_token: string;
  teams_enabled: boolean;
  teams_webhook_url: string;
}

const DEFAULTS: NotificationPrefs = {
  email_digest_enabled: false,
  email_digest_frequency: "daily",
  email_recipients: [],
  slack_enabled: false,
  slack_webhook_url: "",
  slack_channel: "",
  slack_dm_on_critical: false,
  pagerduty_enabled: false,
  pagerduty_routing_key: "",
  pagerduty_severity_threshold: "HIGH",
  splunk_enabled: false,
  splunk_hec_url: "",
  splunk_hec_token: "",
  teams_enabled: false,
  teams_webhook_url: "",
};

type ChannelTestResult = { ok: boolean; message: string };

/** Inline result of a channel test — green for success, red for failure. */
function TestResultNote({ result }: { result?: ChannelTestResult }) {
  if (!result) return null;
  return (
    <span
      role="status"
      className={cn("flex items-center gap-1 text-xs", result.ok ? "text-status-success" : "text-severity-critical")}
    >
      {result.ok ? (
        <CheckCircle2 className="h-3 w-3" aria-hidden />
      ) : (
        <AlertCircle className="h-3 w-3" aria-hidden />
      )}
      {result.message}
    </span>
  );
}

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, ChannelTestResult>>({});
  const [emailInput, setEmailInput] = useState("");

  const load = useCallback(() => {
    fetchFromBackend<{ preferences?: NotificationPrefs }>(
      "/api/v1/settings/notifications",
      { silent: true }
    ).then((d) => {
      if (d?.preferences) setPrefs(d.preferences);
      setLoaded(true);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const res = await fetchFromBackend<{ status?: string }>("/api/v1/settings/notifications", {
      method: "PUT",
      body: JSON.stringify(prefs),
    });
    setSaving(false);
    if (res?.status === "saved") {
      toast("Saved", { description: "Notification preferences updated." });
    }
  };

  const testChannel = async (channel: string) => {
    setTesting(channel);
    const raw = await fetch(`/api/backend/api/v1/settings/notifications/test?channel=${channel}`, {
      method: "POST",
    });
    const body = await raw.json().catch(() => ({}));
    const unwrapped = (unwrapEnvelope(body) ?? {}) as { status?: string; detail?: string };
    setTesting(null);
    if (raw.ok && unwrapped?.status === "sent") {
      setTestResult((p) => ({ ...p, [channel]: { ok: true, message: "Test sent successfully" } }));
    } else {
      setTestResult((p) => ({ ...p, [channel]: { ok: false, message: `Failed: ${unwrapped?.detail || raw.status}` } }));
    }
  };

  const addEmail = () => {
    if (!emailInput.trim()) return;
    if (!emailInput.includes("@")) {
      toast("Invalid email", { description: "Enter a valid email address.", variant: "error" });
      return;
    }
    setPrefs({ ...prefs, email_recipients: [...prefs.email_recipients, emailInput.trim()] });
    setEmailInput("");
  };

  const removeEmail = (idx: number) => {
    setPrefs({ ...prefs, email_recipients: prefs.email_recipients.filter((_, i) => i !== idx) });
  };

  if (!loaded) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notifications"
        description="Configure how and where you receive alerts — email digests, Slack, PagerDuty, Splunk, and Teams."
        icon={<BellRing className="h-5 w-5" />}
        actions={
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save all
          </Button>
        }
      />

      {/* ----- Email Digest ----- */}
      <DashboardCard
        title="Email Digest"
        description="Receive periodic summaries of containment alerts and system events."
        badge={
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={prefs.email_digest_enabled}
              onChange={(e) => setPrefs({ ...prefs, email_digest_enabled: e.target.checked })}
            />
            <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-status-success peer-focus:ring-2 peer-focus:ring-status-success/30 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
          </label>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Frequency</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={prefs.email_digest_frequency}
              onChange={(e) => setPrefs({ ...prefs, email_digest_frequency: e.target.value })}
            >
              <option value="realtime">Real-time</option>
              <option value="daily">Daily digest</option>
              <option value="weekly">Weekly summary</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Recipients</label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="analyst@company.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEmail()}
              />
              <Button variant="outline" size="sm" onClick={addEmail}>
                Add
              </Button>
            </div>
            {prefs.email_recipients.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {prefs.email_recipients.map((email, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 pr-1">
                    <Mail className="h-3 w-3" />
                    {email}
                    <button
                      onClick={() => removeEmail(i)}
                      aria-label={`Remove recipient ${email}`}
                      title={`Remove ${email}`}
                      className="ml-1 rounded p-0.5 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => testChannel("email")}
            disabled={testing === "email"}
          >
            {testing === "email" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send test email
          </Button>
          <TestResultNote result={testResult["email"]} />
        </div>
      </DashboardCard>

      {/* ----- Slack ----- */}
      <DashboardCard
        title="Slack"
        description="Receive critical alerts directly in Slack channels or via DM."
        badge={
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={prefs.slack_enabled}
              onChange={(e) => setPrefs({ ...prefs, slack_enabled: e.target.checked })}
            />
            <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-status-success peer-focus:ring-2 peer-focus:ring-status-success/30 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
          </label>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Webhook URL</label>
            <Input
              type="password"
              placeholder="https://hooks.slack.com/services/..."
              value={prefs.slack_webhook_url}
              onChange={(e) => setPrefs({ ...prefs, slack_webhook_url: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Channel</label>
            <Input
              placeholder="#containment-alerts"
              value={prefs.slack_channel}
              onChange={(e) => setPrefs({ ...prefs, slack_channel: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={prefs.slack_dm_on_critical}
              onChange={(e) => setPrefs({ ...prefs, slack_dm_on_critical: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            DM on critical alerts
          </label>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => testChannel("slack")}
            disabled={testing === "slack"}
          >
            {testing === "slack" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Test
          </Button>
          <TestResultNote result={testResult["slack"]} />
        </div>
      </DashboardCard>

      {/* ----- PagerDuty ----- */}
      <DashboardCard
        title="PagerDuty"
        description="Trigger PagerDuty incidents for critical containment breaches."
        badge={
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={prefs.pagerduty_enabled}
              onChange={(e) => setPrefs({ ...prefs, pagerduty_enabled: e.target.checked })}
            />
            <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-status-success peer-focus:ring-2 peer-focus:ring-status-success/30 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
          </label>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Routing Key</label>
            <Input
              type="password"
              placeholder="PD integration key"
              value={prefs.pagerduty_routing_key}
              onChange={(e) => setPrefs({ ...prefs, pagerduty_routing_key: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Minimum severity</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={prefs.pagerduty_severity_threshold}
              onChange={(e) => setPrefs({ ...prefs, pagerduty_severity_threshold: e.target.value })}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical only</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => testChannel("pagerduty")}
            disabled={testing === "pagerduty"}
          >
            {testing === "pagerduty" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Test incident
          </Button>
          <TestResultNote result={testResult["pagerduty"]} />
        </div>
      </DashboardCard>

      {/* ----- Splunk ----- */}
      <DashboardCard
        title="Splunk"
        description="Forward alerts to Splunk via HTTP Event Collector (HEC)."
        badge={
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={prefs.splunk_enabled}
              onChange={(e) => setPrefs({ ...prefs, splunk_enabled: e.target.checked })}
            />
            <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-status-success peer-focus:ring-2 peer-focus:ring-status-success/30 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
          </label>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">HEC URL</label>
            <Input
              placeholder="https://splunk.example.com:8088/services/collector"
              value={prefs.splunk_hec_url}
              onChange={(e) => setPrefs({ ...prefs, splunk_hec_url: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">HEC Token</label>
            <Input
              type="password"
              placeholder="Splunk HEC token"
              value={prefs.splunk_hec_token}
              onChange={(e) => setPrefs({ ...prefs, splunk_hec_token: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => testChannel("splunk")}
            disabled={testing === "splunk"}
          >
            {testing === "splunk" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Test HEC event
          </Button>
          <TestResultNote result={testResult["splunk"]} />
        </div>
      </DashboardCard>

      {/* ----- Microsoft Teams ----- */}
      <DashboardCard
        title="Microsoft Teams"
        description="Post containment alerts to a Teams channel via incoming webhook."
        badge={
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={prefs.teams_enabled}
              onChange={(e) => setPrefs({ ...prefs, teams_enabled: e.target.checked })}
            />
            <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-status-success peer-focus:ring-2 peer-focus:ring-status-success/30 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
          </label>
        }
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Webhook URL</label>
          <Input
            type="password"
            placeholder="https://company.webhook.office.com/..."
            value={prefs.teams_webhook_url}
            onChange={(e) => setPrefs({ ...prefs, teams_webhook_url: e.target.value })}
          />
        </div>
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => testChannel("teams")}
            disabled={testing === "teams"}
          >
            {testing === "teams" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Test message
          </Button>
          <TestResultNote result={testResult["teams"]} />
        </div>
      </DashboardCard>
    </div>
  );
}
