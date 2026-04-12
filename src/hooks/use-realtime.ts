"use client";

import { useEffect, useRef, useCallback } from "react";

type RealtimeEvent = {
  type: string;
  payload: Record<string, unknown>;
};

type Handler = (event: RealtimeEvent) => void;

/**
 * Hook para consumir eventos SSE do endpoint /api/events.
 * Reconecta automaticamente em caso de falha.
 */
export function useRealtime(onEvent: Handler) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const reconnectDelay = useRef(1000);

  const connect = useCallback(() => {
    const es = new EventSource("/api/events");

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        handlerRef.current(event);
        reconnectDelay.current = 1000; // reset após sucesso
      } catch {
        // ignorar parse errors
      }
    };

    es.onerror = () => {
      es.close();
      // Reconectar com backoff exponencial (máx 30s)
      const delay = Math.min(reconnectDelay.current, 30_000);
      reconnectDelay.current = delay * 2;
      setTimeout(connect, delay);
    };

    return es;
  }, []);

  useEffect(() => {
    const es = connect();
    return () => {
      es.close();
    };
  }, [connect]);
}
