// frontend/src/hooks/useSocket.ts
'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

function getWsUrl() {
  if (process.env.NEXT_PUBLIC_WS_URL && !process.env.NEXT_PUBLIC_WS_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:4000`;
  }
  return 'http://localhost:4000';
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const targetWsUrl = getWsUrl();
    const socketInstance = io(targetWsUrl, {
      transports: ['websocket'],
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return { socket, isConnected };
}