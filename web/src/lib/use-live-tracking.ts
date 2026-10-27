"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/contexts/socket-context";

export type LiveFix = {
  lat: number;
  lng: number;
  at: string;
  accuracy: number | null;
  heading: number | null;
  distanceKm: number | null;
  etaMinutes: number | null;
};

/**
 * Subscribes to one booking's live provider position over Socket.IO. The server
 * only lets the booking's own customer, provider or an admin into the room, and
 * re-joining on reconnect keeps the feed alive through a flaky mobile network.
 */
export function useLiveTracking(bookingId: string, enabled: boolean) {
  const { socket, connected } = useSocket();
  const [fix, setFix] = useState<LiveFix | null>(null);

  useEffect(() => {
    if (!socket || !enabled) return;
    const join = () => socket.emit("join-booking", bookingId);
    const onLocation = (data: {
      bookingId?: string;
      latitude: number;
      longitude: number;
      timestamp: string;
      accuracy?: number | null;
      heading?: number | null;
      distanceKm?: number | null;
      etaMinutes?: number | null;
    }) => {
      if (data.bookingId && data.bookingId !== bookingId) return;
      setFix({
        lat: Number(data.latitude),
        lng: Number(data.longitude),
        at: data.timestamp,
        accuracy: data.accuracy ?? null,
        heading: data.heading ?? null,
        distanceKm: data.distanceKm ?? null,
        etaMinutes: data.etaMinutes ?? null,
      });
    };
    join();
    socket.on("connect", join);
    socket.on("provider-location", onLocation);
    return () => {
      socket.off("connect", join);
      socket.off("provider-location", onLocation);
      socket.emit("leave-booking", bookingId);
    };
  }, [socket, connected, bookingId, enabled]);

  return { fix, connected };
}

/** Shortest distance in metres from a point to a polyline of [lat, lng] pairs. */
export function metresOffRoute(point: [number, number], route: [number, number][]) {
  if (route.length < 2) return 0;
  const toXY = ([lat, lng]: [number, number]) => [lng * 111320 * Math.cos((point[0] * Math.PI) / 180), lat * 110540];
  const [px, py] = toXY(point);
  let best = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const [ax, ay] = toXY(route[i]);
    const [bx, by] = toXY(route[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}
