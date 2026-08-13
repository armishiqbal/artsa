// ARTSA Ingest Endpoint Load Test
//
// Simulates high-frequency tool-call ingest from multiple concurrent
// agent runtimes.  Used to benchmark containment engine throughput.
//
//   k6 run tests/k6/ingest-load.js
//   k6 run --vus 100 --duration 300s tests/k6/ingest-load.js

import { check, sleep } from "k6";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

const API_URL = __ENV.ARTSA_API_URL || "http://localhost:8000";
const API_KEY = __ENV.ARTSA_API_KEY || "";

const ingestErrorRate = new Rate("ingest_errors");
const ingestDuration = new Trend("ingest_duration_ms");
const blockedRate = new Rate("ingest_blocked");

const HEADERS = {
  "Content-Type": "application/json",
  ...(API_KEY ? { Authorization: `Bearer ${API_KEY}`, "X-API-Key": API_KEY } : {}),
};

// Sample tool-call payloads rotating through various threat profiles
const PAYLOADS = [
  // Safe file read
  { tool_name: "read_file", arguments: { path: "/tmp/notes.txt" } },
  // Safe search
  { tool_name: "search", arguments: { query: "weather forecast" } },
  // Suspicious shell command
  { tool_name: "shell", arguments: { command: "curl http://external.com/data" } },
  // Suspicious file access
  { tool_name: "read_file", arguments: { path: "/etc/passwd" } },
  // API call
  { tool_name: "api_request", arguments: { method: "GET", url: "https://api.example.com/v1/users" } },
  // Database query
  { tool_name: "database_query", arguments: { sql: "SELECT * FROM users LIMIT 10" } },
];

function randomPayload() {
  const idx = Math.floor(Math.random() * PAYLOADS.length);
  const base = PAYLOADS[idx];
  return {
    id: `${__VU}-${__ITER}-${Date.now()}`,
    session_id: `loadtest-session-${__VU}`,
    agent_id: `loadtest-agent-${__VU % 3}`,
    tool_name: base.tool_name,
    arguments: base.arguments,
    trace_id: `trace-${__VU}-${__ITER}`,
  };
}

export const options = {
  vus: parseInt(__ENV.VUS || "20"),
  duration: __ENV.DURATION ? `${__ENV.DURATION}s` : "60s",
  thresholds: {
    "ingest_errors": ["rate<0.05"],
    "http_req_duration": ["p(95)<1000"],
    "http_reqs": ["rate>50"],
  },
};

export default function () {
  const payload = randomPayload();
  const res = http.post(
    `${API_URL}/api/v1/ingest`,
    JSON.stringify(payload),
    { headers: HEADERS, tags: { name: "ingest" } }
  );

  ingestDuration.add(res.timings.duration);
  ingestErrorRate.add(res.status >= 500);

  if (res.status === 200 || res.status === 201) {
    try {
      const body = JSON.parse(res.body);
      const verdict = body.verdict || (body.data && body.data.verdict);
      const action = verdict?.recommended_action || "NONE";
      blockedRate.add(action === "KILL" || action === "QUARANTINE");
      check(res, {
        "ingest response has verdict": () => verdict !== undefined,
      });
    } catch {
      ingestErrorRate.add(true);
    }
  }

  sleep(0.1); // 100 ms between calls per VU ≈ 10 req/s per VU
}
