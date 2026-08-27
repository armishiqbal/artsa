"use client";

import { useEffect, useRef, useState } from "react";

interface ReconnectingWebSocketOptions {
  enabled?: boolean;
  maxDelayMs?: number;
  baseDelayMs?: number;
  onOpen?: () => void;
  onClose?: () => void;
  /**
   * Async URL factory — called before every connect attempt (initial and each
   * reconnect). Use it to mint a fresh short-lived WS ticket per attempt so a
   * single-use ticket is never reused across reconnects.
   */
  resolveUrl?: () => Promise<string>;
}

/**
 * WebSocket hook with exponential backoff reconnect.
 * Replies to server `ping` frames so the containment feed stays open.
 */
export function useReconnectingWebSocket(
  url: string = "",
  onMessage: (payload: unknown) => void,
  options: ReconnectingWebSocketOptions = {}
) {
  const {
    enabled = true,
    maxDelayMs = 30_000,
    baseDelayMs = 1_000,
    onOpen,
    onClose,
    resolveUrl,
  } = options;
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  onMessageRef.current = onMessage;
  onOpenRef.current = onOpen;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    let ws: WebSocket | null = null;
    let cancelled = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let clientPingTimer: ReturnType<typeof setInterval> | null = null;

    const clearClientPing = () => {
      if (clientPingTimer) {
        clearInterval(clientPingTimer);
        clientPingTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      clearClientPing();
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      attempt += 1;
      retryTimer = setTimeout(connect, delay);
    };

    const connect = async () => {
      if (cancelled) return;

      let targetUrl = url;
      if (resolveUrl) {
        try {
          targetUrl = await resolveUrl();
        } catch {
          scheduleReconnect();
          return;
        }
        if (cancelled) return;
      }

      try {
        ws = new WebSocket(targetUrl);
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        setConnected(true);
        onOpenRef.current?.();
        clearClientPing();
        // Keep the server's last_client_seen fresh even when the UI is idle.
        clientPingTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
          }
        }, 20_000);
      };

      ws.onclose = () => {
        if (cancelled) return;
        clearClientPing();
        setConnected(false);
        onCloseRef.current?.();
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as { type?: string };
          // Answer server heartbeats so the feed is not dropped after ~35s idle.
          if (payload?.type === "ping" && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          }
          onMessageRef.current(payload);
        } catch {
          // ignore malformed payloads
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearClientPing();
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
      setConnected(false);
    };
  }, [url, resolveUrl, enabled, maxDelayMs, baseDelayMs]);

  return connected;
}
