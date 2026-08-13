// ARTSA k6 Load Testing Suite
//
// Usage:
//   k6 run tests/k6/ingest-load.js
//   k6 run --vus 50 --duration 60s tests/k6/ingest-load.js
//   k6 run --vus 100 --duration 120s tests/k6/health-check.js
//
// Environment variables:
//   ARTSA_API_URL   — Base URL (default: http://localhost:8000)
//   ARTSA_API_KEY   — API key for authenticated endpoints
//   VUS             — Virtual users (overrides --vus)
//   DURATION        — Test duration in seconds

const API_URL = __ENV.ARTSA_API_URL || "http://localhost:8000";
const API_KEY = __ENV.ARTSA_API_KEY || "";
const VUS = parseInt(__ENV.VUS || "10");

const HEADERS = {
  "Content-Type": "application/json",
  ...(API_KEY ? { Authorization: `Bearer ${API_KEY}`, "X-API-Key": API_KEY } : {}),
};
