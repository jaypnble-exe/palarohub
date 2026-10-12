"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { createClient } from "@/lib/supabase/browser";
import { toRecordedEvent } from "@/lib/game-events";
import type { GameEventEnvelope } from "@/lib/sports/types";

type Client = ReturnType<typeof createClient>;
type LoggedEvent = GameEventEnvelope & { type: string; payload: object };

/**
 * synced: everything is saved. saving: sending now. retrying: no connection
 * yet, will retry. replaced: another device took over. closed: the game was
 * submitted. conflict: the server has different events; reload to continue.
 */
export type SyncStatus =
  "synced" | "saving" | "retrying" | "replaced" | "closed" | "conflict";

const RETRY_MS = 4000;

/**
 * The game's event list as this device knows it: saved events plus events
 * still being sent. Sends in order, in batches, and retries until saved.
 */
export function useEventLog<E extends LoggedEvent>(
  supabase: Client,
  gameId: string,
  saved: readonly E[],
) {
  const [events, setEvents] = useState<E[]>(() => [...saved]);
  const [pending, setPending] = useState<{ event: E; period: number | null }[]>(
    [],
  );
  const [status, setStatus] = useState<SyncStatus>("synced");
  const sending = useRef(false);
  const stopped = useRef(false);
  const queue = useRef(pending);
  // Runs before the sending effect below, so flush always sees the latest queue.
  useEffect(() => {
    queue.current = pending;
  }, [pending]);

  const flush = useCallback(async () => {
    if (sending.current || stopped.current || !queue.current.length) return;
    sending.current = true;
    const batch = queue.current.slice(0, 200);
    setStatus("saving");
    let error: { code?: string; message: string } | null;
    try {
      ({ error } = await supabase.rpc("record_game_events", {
        p_game_id: gameId,
        p_events: batch.map(({ event, period }) =>
          toRecordedEvent(event, period),
        ),
      }));
    } catch {
      error = { message: "network" };
    }
    sending.current = false;
    if (!error) {
      const sent = new Set(batch.map(({ event }) => event.id));
      const left = queue.current.filter(({ event }) => !sent.has(event.id));
      setPending((current) =>
        current.filter(({ event }) => !sent.has(event.id)),
      );
      setStatus(left.length ? "saving" : "synced");
      return;
    }
    if (error.code === "42501") {
      stopped.current = true;
      setStatus("replaced");
    } else if (error.message.includes("game_not_open")) {
      stopped.current = true;
      setStatus("closed");
    } else if (error.code === "23505" || error.code === "23514") {
      stopped.current = true;
      setStatus("conflict");
    } else setStatus("retrying");
  }, [supabase, gameId]);

  // Keep sending while anything is pending; retry on reconnect or a timer.
  useEffect(() => {
    if (!pending.length || stopped.current) return;
    if (status !== "retrying") {
      void flush();
      return;
    }
    const timer = window.setTimeout(() => void flush(), RETRY_MS);
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", online);
    };
  }, [pending, status, flush]);

  // Warn before closing the page while events are not saved yet.
  useEffect(() => {
    if (!pending.length) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending.length]);

  /** Adds an event; `period` is stored with it for reports and queries. */
  const append = useCallback((event: E, period: number | null) => {
    if (stopped.current) return false;
    setEvents((current) => [...current, event]);
    setPending((current) => [...current, { event, period }]);
    return true;
  }, []);

  return { events, append, status, unsaved: pending.length };
}
