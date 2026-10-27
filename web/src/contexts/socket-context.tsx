'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

export type SocketContextValue = {
  socket: Socket | null;
  connected: boolean;
};

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [socketState, setSocketState] = useState<Socket | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
    const baseUrl = apiUrl.replace(/\/api$/, '') || '';
    const socketUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    const socket = io(socketUrl, { path: '/socket.io', withCredentials: true, autoConnect: true });
    socketRef.current = socket;
    setSocketState(socket);
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    // The handshake reads the sign-in cookie. If the first attempt came before sign-in it is
    // refused, so keep trying until a session exists.
    let retry: number | undefined;
    socket.on('connect_error', () => {
      window.clearTimeout(retry);
      retry = window.setTimeout(() => { if (!socket.connected) socket.connect(); }, 3000);
    });
    return () => {
      window.clearTimeout(retry);
      socket.disconnect();
    };
  }, []);

  // Signing in is a client-side navigation, so reconnect as soon as the page changes.
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && !socket.connected) socket.connect();
  }, [pathname]);

  return (
    <SocketContext.Provider value={{ socket: socketState, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
