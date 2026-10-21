// frontend/src/hooks/useSocket.ts
'use client';

import { useEffect, useState, useRef } from 'react';
import { getWsBaseUrl } from '@/lib/api-config';

type GenericListener = (data: unknown) => void;

export interface SocketLike {
  on: <T = unknown>(event: string, callback: (data: T) => void) => void;
  off: <T = unknown>(event: string, callback?: (data: T) => void) => void;
  emit: (event: string, data?: unknown) => void;
}

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<Map<string, Set<GenericListener>>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      const baseWsUrl = getWsBaseUrl();
      const wsUrl = baseWsUrl.replace(/^http/, 'ws') + '/ws';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setIsConnected(false);
        // Automatic exponential backoff reconnection
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.event) {
            const set = listenersRef.current.get(payload.event);
            if (set) {
              set.forEach((cb) => cb(payload.data));
            }
          }
        } catch {
          // Non-JSON raw message
        }
      };
    };

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const socket: SocketLike = {
    on: <T = unknown>(event: string, callback: (data: T) => void) => {
      if (!listenersRef.current.has(event)) {
        listenersRef.current.set(event, new Set());
      }
      listenersRef.current.get(event)!.add(callback as GenericListener);
    },
    off: <T = unknown>(event: string, callback?: (data: T) => void) => {
      if (!callback) {
        listenersRef.current.delete(event);
      } else {
        const set = listenersRef.current.get(event);
        if (set) {
          set.delete(callback as GenericListener);
        }
      }
    },
    emit: (event: string, data?: unknown) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event, data }));
      }
    },
  };

  return { socket, isConnected };
}
