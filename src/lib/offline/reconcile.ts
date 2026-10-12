import type { LocalEvent } from "./scorebook-store";

interface Sequenced {
  id: string;
  sequence: number;
}

export interface Reconciled<E extends Sequenced> {
  /** Everything the reducer should see: the server's events plus safe unsent ones. */
  events: E[];
  /** Unsent events that can still be sent, in order. */
  pending: { event: E; period: number | null }[];
  /** Unsent events whose number another device already used; they cannot be sent. */
  conflicts: E[];
  /** Unsent on this device but already on the server (a reply was lost). */
  alreadySaved: string[];
}

/**
 * Combines the server's official events with this device's own copy.
 * `parse` validates each locally stored event; anything invalid is dropped.
 */
export function reconcileEvents<E extends Sequenced>(
  server: readonly E[],
  local: readonly LocalEvent[],
  parse: (value: unknown) => E | null,
): Reconciled<E> {
  const serverIds = new Set(server.map((event) => event.id));
  const usedSequences = new Set(server.map((event) => event.sequence));
  const pending: Reconciled<E>["pending"] = [];
  const conflicts: E[] = [];
  const alreadySaved: string[] = [];
  for (const row of local) {
    if (row.state !== "pending") continue;
    const event = parse(row.event);
    if (!event) continue;
    if (serverIds.has(event.id)) alreadySaved.push(event.id);
    else if (usedSequences.has(event.sequence)) conflicts.push(event);
    else pending.push({ event, period: row.period });
  }
  pending.sort((a, b) => a.event.sequence - b.event.sequence);
  return {
    events: [...server, ...pending.map(({ event }) => event)],
    pending,
    conflicts,
    alreadySaved,
  };
}
