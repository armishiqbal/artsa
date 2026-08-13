# ADR-003: WebSocket Heartbeat and Reconnection Protocol

**Status:** Accepted  
**Date:** 2026-08-11  
**Deciders:** ARTSA Platform Security Team

## Context

The ARTSA WebSocket telemetry feed streams live containment events (tool calls,
detector firings, verdicts) to the frontend dashboard and external SIEM consumers.
In production, connections are dropped by load balancers (typical 60–120 s idle
timeout), network partitions, or client restarts.

Without heartbeats, the server cannot distinguish a silently dropped connection
from an idle one, and clients lose event continuity on reconnect.

## Decision

Implement a **bidirectional heartbeat protocol** with **reconnection token support**.

### Protocol Handshake

On connection, the server sends a `hello` message:

```json
{
  "type": "hello",
  "version": "0.3.0",
  "heartbeat_interval_ms": 25000,
  "heartbeat_timeout_ms": 10000,
  "reconnect_token": "<opaque-token>",
  "reconnect_window_s": 120
}
```

### Client → Server Ping

Clients send periodic pings to signal liveness:

```json
{ "type": "ping", "seq": 42, "timestamp": 1723456789.123 }

{ "type": "pong", "timestamp": 1723456789.123, "seq": 42 }
```

### Server → Client Ping

When no telemetry events are available for `HEARTBEAT_INTERVAL` (25 s), the server
sends a ping. If the client does not respond within `HEARTBEAT_TIMEOUT` (10 s), the
server disconnects.

### Reconnection

Clients may reconnect with their `reconnect_token` within the 120 s window:

```json
{ "type": "reconnect", "reconnect_token": "...", "from_seq": 42 }
```

The server replays missed events from `from_seq` up to the latest sequence number.

### Constants

| Parameter | Value |
|---|---|
| `HEARTBEAT_INTERVAL` | 25 s |
| `HEARTBEAT_TIMEOUT` | 10 s (35 s total before disconnect) |
| `RECONNECT_WINDOW` | 120 s |
| Max replay events | 200 |

## Consequences

- **Positive:** Survives load balancer idle timeouts (common at 60 s).
- **Positive:** Clients can reconnect without missing events.
- **Positive:** Stale connections are cleaned up within 35 s.
- **Negative:** Reconnection tokens are stored in memory — not shared across
  horizontally scaled instances. A future iteration should use Redis for token
  storage.
- **Negative:** Event replay is limited to 200 events (~10–60 s of typical
  throughput). Longer disconnections require state re-synchronization via
  the REST API.
