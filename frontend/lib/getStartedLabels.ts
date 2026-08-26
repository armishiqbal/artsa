import type { CaseCategory } from "@/lib/getStarted";

/** Plain-English UI strings for the readiness page — readable by non-engineers. */

export const READINESS_UI = {
  pageTitle: "Ready for production?",
  pageDescription:
    "Three steps: test the guard, send one real event, confirm in the activity log.",
  practiceAttackNote:
    "The scary example text below is a practice attack (like a fire drill). It is not real traffic and nobody should run it on live systems — we use it only to test the guard.",
  gateTitle: "Go-live checklist",
  gateSubtitle: "Test the guard → send one real event → confirm in the activity log",
  signedOff: "Ready to go live",
  notSignedOff: "Still completing checklist",
  testsPassing: "Tests passing",
  exportReport: "Download JSON",
  exportReportMarkdown: "Export Markdown",
  exportReportPdf: "Export PDF",
  step1Title: "Run security tests",
  step1Hint: "Practice attacks and safe requests — see if the guard reacts correctly.",
  step2Title: "Send agent activity to ARTSA",
  step2Hint: "One real event through the same path production will use.",
  step3Title: "Confirm in activity log",
  step3Hint: "Open the log and verify the event was recorded.",
  runAllTests: "Run all security tests",
  runOneTest: "Run this test",
  runningTests: "Running security checks…",
  emptyTitle: "Run the security test pack",
  emptyDescription:
    "Eight practice scenarios check trick attacks, data theft attempts, and normal requests. You will see how dangerous each looked and what ARTSA recommends doing.",
  testPayloadLabel: "Practice example (not real traffic)",
  guardDecision: "Guard decision",
  whatWeDid: "What ARTSA did",
  dangerLevel: "How dangerous it looked",
  confidence: "How sure ARTSA is",
  alertsTriggered: "Warning signs found",
  responseTime: "Response time",
  whatHappened: "What happened",
  engineerDetails: "Technical details (for engineers)",
  falsePositive: "Safe request flagged wrongly — too strict",
  detectionGap: "Attack wasn't caught — needs tuning",
  pass: "Passed",
  review: "Needs review",
  suiteResults: "Test pack results",
  sendTestEvent: "Send test event",
  viewInLog: "View in activity log",
  activityLogTitle: "Activity log",
  activityLogDescription:
    "Every agent tool call ARTSA screens — what happened, how dangerous it looked, and what we did.",
  sessionFocus: "Focused on this session",
  viewReplay: "Open session replay",
  showAllSessions: "Show all sessions",
  noEventsForSession: "No events yet for this session. Send agent activity or run a test from Get Started.",
  manualWiring: "For engineers: wire agents with API",
  apiKeyHelp: "Set up your access key",
  backendOffline: "ARTSA isn't reachable right now. Check that your deployment is running.",
  attacksCaught: "Attacks caught",
  safeAllowed: "Safe allowed",
  needsTuning: "Needs tuning",
  liveActivity: "Live activity",
  liveActivityHint: "Events as they arrive — your test event should appear here.",
  fixInSandbox: "Try in sandbox",
  tunePolicies: "Tune rules",
  autoRunning: "Running security tests automatically…",
} as const;

/** Command Center — integration visibility */
export const COMMAND_CENTER_UI = {
  pageDescription:
    "Mission graph of agent blast radius — live risk, containment verdicts, and investigate-on-select.",
  integrationActivity: "Integration activity",
  integrationActivityHint:
    "Live screening results when your agents send tool calls — not outbound alert webhooks.",
  latestResponse: "Latest response from your integration",
  waitingForTraffic: "No integration traffic yet",
  waitingHint:
    "Connect your agents in Settings, or send a test event from Get Started. Each tool call shows how ARTSA responded.",
  guardConnected: "Guard API online",
  guardOffline: "Guard offline",
  liveFeed: "Live feed connected",
  liveFeedPolling: "Live feed — polling backup",
  eventsScreened: "Events screened",
  activeSessions: "Active sessions",
  viewFullLog: "Full activity log",
  connectIntegration: "Connect integration",
  manageIntegrations: "Manage integrations",
  outboundConnected: "Outbound alerts connected",
  waitingForIngest: "Send agent traffic to see responses here",
  outboundVsIngestNote:
    "Slack and webhooks send alerts out when risks happen. This panel shows what happened when agent traffic came in.",
  sendTestEvent: "Send test event",
  liveFeedNoEvents: "Socket open · waiting for traffic",
  liveFeedActive: "Live feed · receiving events",
  ingestEndpointTitle: "Where external systems send traffic",
  ingestEndpointHint:
    "External agents send tool calls here. Your admin configures the API key in connection settings.",
  ingestKeyMissing: "ARTSA API key not set on server — ingest may be rejected",
  ingestKeyOk: "Server API key configured",
  testIngestNow: "Test ingest from dashboard",
  testIngestOk: "Ingest works — check Latest response above",
  testIngestFailed: "Ingest failed — check API key and backend logs",
  inboundTitle: "Inbound — agent traffic into ARTSA",
  inboundDetail: "Agent tool calls into ARTSA — powers Command Center and the activity log.",
  outboundTitle: "Outbound — alerts to your systems",
  outboundDetail: "Slack, webhooks, Custom Outbound. Sends alerts out; does not ingest traffic.",
  sendSampleAlert: "Send sample to your URL",
  ragGuide: "RAG + Astra guide",
  getStarted: "Run readiness test",
  agent: "Agent",
  toolCall: "Tool call",
  session: "Session",
  recentResponses: "Recent responses",
  sampleAlertDispatched: "Sample alert sent to your URL (outbound only)",
} as const;

export const INTEGRATION_UI = {
  sendSampleToUrl: "Send sample to your URL",
  sampleSent: "Sample sent to your URL",
  testProvider: "Test LLM",
  inboundTab: "Inbound (agent traffic)",
  outboundTab: "Outbound (alerts)",
} as const;

export const INTEGRATION_HEALTH_UI = {
  title: "Integration health",
  subtitle: "Agent traffic powers Command Center. Outbound channels only send alerts to your systems.",
  apiOnline: "Guard API connected",
  apiOffline: "Guard API offline",
  trafficSeen: "Agent traffic received — Command Center is live",
  noTrafficYet: "No agent traffic yet — send a test event from Get Started",
  wsLive: "Live WebSocket feed connected",
  wsPolling: "Polling backup — events still appear after ingest",
  outboundOptional: "No outbound channels — optional for SOC alerts",
  outboundReminder:
    "Testing outbound sends a sample alert to your URL. It does not populate Command Center.",
} as const;

export const INGEST_UI = {
  copyCurl: "Copy ingest curl",
  copied: "Copied",
  wireTitle: "Wire production ingest",
  wireHint: "Send agent tool calls through ingest. Events appear in Command Center and the activity log.",
} as const;

export const CONNECTION_UI = {
  backendOfflineTitle: "Can't connect to ARTSA",
  backendOfflineHint:
    "Live screening, activity logs, and setup tests need the ARTSA API. Check your deployment or ask your platform admin.",
  whenOfflinePrimary: "Connection settings",
  whenOfflineSecondary: "Setup guide",
  offlineNav: "API offline",
  pollingNav: "Polling backup",
} as const;

/** Reuse for inline errors when fetch fails because API is down */
export const API_UNAVAILABLE = {
  short: "ARTSA API unavailable",
  hint: "Check that your ARTSA deployment is running, then refresh this page.",
  scan: "Scan couldn't run — ARTSA API unavailable.",
  sandbox: "Evaluation couldn't run — ARTSA API unavailable.",
  rag: "RAG scan couldn't run — ARTSA API unavailable.",
} as const;

export const SANDBOX_UI = {
  liveMonitoringTitle: "Sandbox ≠ live Command Center",
  liveMonitoringHint:
    "Tests here run in isolation. Connect production agents through Get Started to see live activity on the dashboard.",
  sendTestEvent: "Send a test event",
} as const;

export const COACHMARK_UI = {
  title: "No agent traffic yet",
  description:
    "Your guard is online. Send one test event from Get Started — the same path production agents use.",
  autoIngestOk: "Test event sent — watch the latest response above",
  autoIngestFailed: "Could not send the test event — check connection settings",
} as const;

/** Empty states — plain English, no API paths */
export const EMPTY_STATE_UI = {
  allClearTitle: "All clear",
  allClearDescription:
    "No risky sessions in live telemetry. Connect agents or run a red-team scan to generate activity.",
  noRiskTrendTitle: "No trends yet",
  noRiskTrendDescription:
    "Risk charts populate from live ingest events and completed scans — none recorded yet.",
  noActivityTitle: "No activity yet",
  noActivityDescription: "When agents connect and emit tool calls, screened events appear here.",
  noTopologyTitle: "No agent map yet",
  noTopologyDescription:
    "Topology builds from live session telemetry. Connect agents or ingest tool-call traffic.",
  noAnalyticsTitle: "No analytics yet",
  noAnalyticsDescription:
    "Analytics require live events or completed red-team scans. Nothing to chart yet.",
  openSetup: "Open setup guide",
  runWargame: "Launch wargame",
  viewCommandCenter: "Command Center",
} as const;

export const FILTER_LABELS: Record<CaseCategory | "all", string> = {
  all: "All tests",
  attack: "Attack cases",
  safe: "Safe requests",
  edge: "Edge cases",
};

export function guardDecisionLabel(verdict: string): string {
  const map: Record<string, string> = {
    SAFE: "Looks safe",
    SUSPICIOUS: "Suspicious",
    BREACHED: "Serious threat",
    ESCALATED: "Needs human review",
  };
  return map[verdict] ?? verdict;
}

export function guardActionLabel(action: string): string {
  const map: Record<string, string> = {
    NONE: "Allow — no action",
    ALERT: "Alert your team",
    THROTTLE: "Slow the agent down",
    KILL: "Stop the session",
    QUARANTINE: "Lock for review",
  };
  return map[action] ?? action;
}

export function failureLabelPlain(expectBenign: boolean | undefined): string {
  return expectBenign ? READINESS_UI.falsePositive : READINESS_UI.detectionGap;
}
