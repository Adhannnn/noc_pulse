// frontend/src/hooks/useSocket.ts
'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getWsBaseUrl } from '@/lib/api-config';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const targetWsUrl = getWsBaseUrl();
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