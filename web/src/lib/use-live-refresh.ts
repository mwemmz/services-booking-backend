"use client";

import { useEffect, useRef } from "react";
import { useSocket } from "@/contexts/socket-context";

const EVENTS = ["booking-status-update", "booking-quote", "new-booking", "message:new"];

/**
 * Runs `reload` whenever the server pushes a booking or message event, so a screen
 * updates without a refresh. When the socket is not connected it falls back to a
 * slow poll, and it also reloads when the tab becomes visible again.
 */
export function useLiveRefresh(reload: () => void, events: string[] = EVENTS) {
  const { socket, connected } = useSocket();
  const latest = useRef(reload);
  latest.current = reload;

  useEffect(() => {
    let pending: number | undefined;
    const run = () => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => latest.current(), 250);
    };
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVisible);
    socket?.on("connect", run);
    for (const name of events) socket?.on(name, run);
    const poll = connected ? undefined : window.setInterval(run, 8000);
    return () => {
      window.clearTimeout(pending);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      socket?.off("connect", run);
      for (const name of events) socket?.off(name, run);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, connected, events.join(",")]);
}
