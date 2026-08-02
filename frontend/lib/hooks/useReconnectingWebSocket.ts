"use client";

import { useEffect, useRef, useState } from "react";

interface ReconnectingWebSocketOptions {
  enabled?: boolean;
  maxDelayMs?: number;
  baseDelayMs?: number;
  onOpen?: () => void;
  onClose?: () => void;
}

/**
 * WebSocket hook with exponential backoff reconnect.
 * Reconnects when `url` changes (e.g. after SSO token refresh).
 */
export function useReconnectingWebSocket(
  url: string,
  onMessage: (payload: unknown) => void,
  options: ReconnectingWebSocketOptions = {}
) {
  const { enabled = true, maxDelayMs = 30_000, baseDelayMs = 1_000, onOpen, onClose } = options;
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

    const scheduleReconnect = () => {
      if (cancelled) return;
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      attempt += 1;
      retryTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (cancelled) return;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        setConnected(true);
        onOpenRef.current?.();
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        onCloseRef.current?.();
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onmessage = (event) => {
        try {
          onMessageRef.current(JSON.parse(event.data));
        } catch {
          // ignore malformed payloads
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
      setConnected(false);
    };
  }, [url, enabled, maxDelayMs, baseDelayMs]);

  return connected;
}
