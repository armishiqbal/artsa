#!/usr/bin/env node
/**
 * Free a TCP port before starting a dev server.
 *
 * Why: `uvicorn --reload` occasionally leaves a stale worker bound to port 8000
 * (or a deprecated api-gateway process lingers). The stale process answers
 * /api/v1/health but 404s on newer routes like /api/v1/metrics/dashboard,
 * producing a confusing "404 storm" in the frontend. Killing any existing
 * listener first guarantees the current unified API (backend/src/api/main.py)
 * is the one serving the port.
 *
 * Usage: node scripts/free-port.js <port>
 * No-op on unsupported platforms; never fails the dev command.
 */

const { execSync } = require("node:child_process");

const port = process.argv[2] || "8000";

function pidsOnPort(p) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano -p tcp | findstr :${p}`, {
        stdio: ["ignore", "pipe", "ignore"],
      }).toString();
      return [
        ...new Set(
          out
            .split(/\r?\n/)
            .map((line) => line.trim().split(/\s+/).pop())
            .filter((pid) => pid && /^\d+$/.test(pid))
        ),
      ];
    }
    // macOS / Linux
    const out = execSync(`lsof -ti tcp:${p} -sTCP:LISTEN`, {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    // lsof/netstat returns non-zero when nothing is listening — that's fine.
    return [];
  }
}

function kill(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

const pids = pidsOnPort(port);
if (pids.length === 0) {
  process.exit(0);
}

for (const pid of pids) {
  const ok = kill(pid);
  console.log(
    ok
      ? `[free-port] freed port ${port} (killed stale PID ${pid})`
      : `[free-port] could not kill PID ${pid} on port ${port}`
  );
}
