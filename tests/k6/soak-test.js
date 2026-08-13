// ARTSA Endurance / Soak Test
//
// Sustained moderate load over an extended period.  Validates:
//   - No memory leaks in containment engine
//   - Detector stability under long-running sessions
//   - Session accumulation behaviour
//
//   k6 run tests/k6/soak-test.js
//   k6 run --vus 30 --duration 1800s tests/k6/soak-test.js

import { check, sleep } from "k6";
import http from "k6/http";
import { Rate, Trend, Counter } from "k6/metrics";

const API_URL = __ENV.ARTSA_API_URL || "http://localhost:8000";
const API_KEY = __ENV.ARTSA_API_KEY || "";

const soakErrors = new Rate("soak_errors");
const sessionCreates = new Counter("sessions_created");
const totalIngests = new Counter("total_ingests");
const soakDuration = new Trend("soak_request_duration_ms");

const HEADERS = {
  "Content-Type": "application/json",
  ...(API_KEY ? { Authorization: `Bearer ${API_KEY}`, "X-API-Key": API_KEY } : {}),
};

export const options = {
  vus: parseInt(__ENV.VUS || "15"),
  duration: __ENV.DURATION ? `${__ENV.DURATION}s` : "600s",
  thresholds: {
    "soak_errors": ["rate<0.02"],
    "http_req_duration": ["p(95)<2000"],
  },
};

// Each VU gets a unique session for the run
const SESSION_ID = `soak-session-${__VU}-${Date.now()}`;
const AGENT_ID = `soak-agent-${__VU % 5}`;
let seq = 0;

const TOOLS = [
  { name: "read_file", args: { path: "/tmp/notes.txt" } },
  { name: "search", args: { query: "status update" } },
  { name: "shell", args: { command: "ls -la" } },
  { name: "shell", args: { command: "curl http://internal-api/v1/status" } },
  { name: "database_query", args: { sql: "SELECT count(*) FROM events" } },
  { name: "api_request", args: { method: "POST", url: "https://hooks.slack.com/services/test" } },
];

export default function () {
  seq++;
  const tool = TOOLS[seq % TOOLS.length];

  const payload = {
    id: `${SESSION_ID}-${seq}`,
    session_id: SESSION_ID,
    agent_id: AGENT_ID,
    tool_name: tool.name,
    arguments: tool.args,
    trace_id: `trace-${SESSION_ID}-${seq}`,
    response: seq % 10 === 0 ? { status: "ok", data: "sample response with api_key=sk-test1234567890" } : { status: "ok" },
  };

  const res = http.post(
    `${API_URL}/api/v1/ingest`,
    JSON.stringify(payload),
    { headers: HEADERS, tags: { name: "soak_ingest" } }
  );

  soakDuration.add(res.timings.duration);
  totalIngests.add(1);
  soakErrors.add(res.status >= 500);

  // Periodically check health
  if (seq % 50 === 0) {
    const healthRes = http.get(`${API_URL}/api/v1/health`, { tags: { name: "soak_health" } });
    soakErrors.add(healthRes.status !== 200);
  }

  sleep(1.0);
}
