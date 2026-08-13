// ARTSA Health Check Load Test
//
// Ramps virtual users to verify health/ready endpoints remain
// responsive under load.  Used in CI gating and capacity planning.
//
//   k6 run tests/k6/health-check.js
//   k6 run --vus 20 --duration 30s tests/k6/health-check.js

import { check, sleep } from "k6";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

const API_URL = __ENV.ARTSA_API_URL || "http://localhost:8000";

const healthErrorRate = new Rate("health_errors");
const readyErrorRate = new Rate("ready_errors");
const healthDuration = new Trend("health_duration_ms");
const readyDuration = new Trend("ready_duration_ms");

export const options = {
  vus: parseInt(__ENV.VUS || "10"),
  duration: __ENV.DURATION ? `${__ENV.DURATION}s` : "30s",
  thresholds: {
    "health_errors": ["rate<0.01"],
    "ready_errors": ["rate<0.01"],
    "http_req_duration": ["p(95)<500"],
  },
};

export default function () {
  // Health endpoint
  const healthRes = http.get(`${API_URL}/api/v1/health`, {
    tags: { name: "health" },
  });
  healthDuration.add(healthRes.timings.duration);
  healthErrorRate.add(healthRes.status !== 200);
  check(healthRes, {
    "health status 200": (r) => r.status === 200,
    "health returns json": (r) => {
      try { JSON.parse(r.body); return true; } catch { return false; }
    },
  });

  // Ready endpoint
  const readyRes = http.get(`${API_URL}/api/v1/ready`, {
    tags: { name: "ready" },
  });
  readyDuration.add(readyRes.timings.duration);
  readyErrorRate.add(readyRes.status !== 200 && readyRes.status !== 503);
  check(readyRes, {
    "ready status 2xx/503": (r) => r.status === 200 || r.status === 503,
  });

  sleep(1);
}
