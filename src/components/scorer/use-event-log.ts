"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { createClient } from "@/lib/supabase/browser";
import { toRecordedEvent } from "@/lib/game-events";
import type { ScorebookStore } from "@/lib/offline/scorebook-store";
import type { GameEventEnvelope } from "@/lib/sports/types";
import { gameLiveChannel } from "@/lib/game-live";

type Client = ReturnType<typeof createClient>;
type LoggedEvent = GameEventEnvelope & { type: string; payload: object };
export type PendingEvent<E> = { event: E; period: number | null };

/**
 * synced: everything is saved. saving: sending now. retrying: saved on this
 * device, will send when possible. replaced: another device took over.
 * closed: the game was submitted. conflict: the server has different events.
 */
export type SyncStatus =
  "synced" | "saving" | "retrying" | "replaced" | "closed" | "conflict";

const RETRY_MS = 4000;

/**
 * The game's event list as this device knows it. Each new action is written
 * to the device store, then sent in order, in batches, until the server has it.
 */
export function useEventLog<E extends LoggedEvent>(
  supabase: Client,
  gameId: string,
  initial: { events: readonly E[]; pending: readonly PendingEvent<E>[] },
  store: ScorebookStore,
) {
  const [events, setEvents] = useState<E[]>(() => [...initial.events]);
  const [pending, setPending] = useState<PendingEvent<E>[]>(() => [
    ...initial.pending,
  ]);
  const [status, setStatus] = useState<SyncStatus>(() =>
    initial.pending.length ? "saving" : "synced",
  );
  const [storageFailed, setStorageFailed] = useState(false);
  const sending = useRef(false);
  const stopped = useRef(false);
  const queue = useRef(pending);
  const live = useRef<ReturnType<typeof gameLiveChannel> | null>(null);
  const lastSaved = useRef(
    initial.events
      .filter(
        (event) => !initial.pending.some((item) => item.event.id === event.id),
      )
      .at(-1)?.id,
  );
  useEffect(() => {
    const channel = gameLiveChannel(supabase, gameId, {
      clockRequest(requestId, receivedAt) {
        if (stopped.current || !lastSaved.current) return;
        channel.send("clock_reply", {
          requestId,
          receivedAt,
          repliedAt: Date.now(),
          eventId: lastSaved.current,
        });
      },
    });
    live.current = channel;
    return () => {
      live.current = null;
      channel.close();
    };
  }, [supabase, gameId]);
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
      lastSaved.current = batch.at(-1)!.event.id;
      live.current?.send("saved", {});
      const sent = batch.map(({ event }) => event.id);
      const done = new Set(sent);
      const left = queue.current.filter(({ event }) => !done.has(event.id));
      store.markSynced(sent).catch(() => setStorageFailed(true));
      setPending((current) =>
        current.filter(({ event }) => !done.has(event.id)),
      );
      setStatus(left.length ? "saving" : "synced");
      return;
    }
    if (error.message.includes("scorer_required")) {
      stopped.current = true;
      setStatus("replaced");
    } else if (error.message.includes("game_not_open")) {
      stopped.current = true;
      setStatus("closed");
    } else if (error.code === "23505" || error.code === "23514") {
      stopped.current = true;
      setStatus("conflict");
    } else {
      // Offline, an expired session, or a server hiccup: keep it on the device and retry.
      setStatus("retrying");
    }
  }, [supabase, gameId, store]);

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

  // Warn before closing while anything is unsynced, even though the device has a copy.
  useEffect(() => {
    if (!pending.length) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending.length]);

  /** Adds an event; `period` is stored with it for reports and queries. */
  const append = useCallback(
    (event: E, period: number | null) => {
      if (stopped.current) return false;
      store.addEvent(gameId, event, period).catch(() => setStorageFailed(true));
      setEvents((current) => [...current, event]);
      setPending((current) => [...current, { event, period }]);
      return true;
    },
    [store, gameId],
  );

  return { events, append, status, unsaved: pending.length, storageFailed };
}
