import Dexie, { type EntityTable } from "dexie";

/** Sync state of an event kept on this device. */
export type LocalEventState = "pending" | "synced" | "discarded";

interface StoredSetup {
  gameId: string;
  setup: unknown;
  savedAt: string;
}

interface StoredEvent {
  id: string;
  gameId: string;
  sequence: number;
  /** The sport module's event, validated again when read back. */
  event: unknown;
  period: number | null;
  state: LocalEventState;
}

export interface LocalEvent {
  event: unknown;
  period: number | null;
  state: LocalEventState;
}

/**
 * The scorer device's own copy of each game it scores. Actions are written
 * here before they are sent, so they survive reloads and lost connections.
 */
export interface ScorebookStore {
  saveSetup(gameId: string, setup: unknown): Promise<void>;
  loadSetup(gameId: string): Promise<unknown>;
  /** Server events are the official record: they are stored as synced. */
  saveServerEvents(
    gameId: string,
    events: readonly { id: string; sequence: number }[],
  ): Promise<void>;
  addEvent(
    gameId: string,
    event: { id: string; sequence: number },
    period: number | null,
  ): Promise<void>;
  markSynced(ids: readonly string[]): Promise<void>;
  /** Unsent events that can no longer be saved stay on the device, set aside. */
  discard(ids: readonly string[]): Promise<void>;
  loadEvents(gameId: string): Promise<LocalEvent[]>;
}

class ScorebookDatabase extends Dexie {
  setups!: EntityTable<StoredSetup, "gameId">;
  events!: EntityTable<StoredEvent, "id">;
  constructor(name: string) {
    super(name);
    this.version(1).stores({
      setups: "gameId",
      events: "id, gameId, [gameId+sequence], [gameId+state]",
    });
  }
}

export function createScorebookStore(
  name = "palarohub-scorebook",
): ScorebookStore {
  const db = new ScorebookDatabase(name);
  return {
    async saveSetup(gameId, setup) {
      await db.setups.put({ gameId, setup, savedAt: new Date().toISOString() });
    },
    async loadSetup(gameId) {
      return (await db.setups.get(gameId))?.setup;
    },
    async saveServerEvents(gameId, events) {
      await db.transaction("rw", db.events, async () => {
        for (const event of events)
          await db.events.put({
            id: event.id,
            gameId,
            sequence: event.sequence,
            event,
            period: (await db.events.get(event.id))?.period ?? null,
            state: "synced",
          });
      });
    },
    async addEvent(gameId, event, period) {
      await db.events.add({
        id: event.id,
        gameId,
        sequence: event.sequence,
        event,
        period,
        state: "pending",
      });
    },
    async markSynced(ids) {
      await db.events
        .where("id")
        .anyOf([...ids])
        .modify({ state: "synced" });
    },
    async discard(ids) {
      await db.events
        .where("id")
        .anyOf([...ids])
        .modify({ state: "discarded" });
    },
    async loadEvents(gameId) {
      const rows = await db.events
        .where("[gameId+sequence]")
        .between([gameId, Dexie.minKey], [gameId, Dexie.maxKey])
        .toArray();
      return rows.map(({ event, period, state }) => ({ event, period, state }));
    },
  };
}

/** An in-memory store for tests and for browsers without IndexedDB. */
export function createMemoryScorebookStore(): ScorebookStore & {
  dump(): StoredEvent[];
} {
  const setups = new Map<string, unknown>();
  const events = new Map<string, StoredEvent>();
  const sorted = (gameId: string) =>
    [...events.values()]
      .filter((row) => row.gameId === gameId)
      .sort((a, b) => a.sequence - b.sequence);
  return {
    async saveSetup(gameId, setup) {
      setups.set(gameId, setup);
    },
    async loadSetup(gameId) {
      return setups.get(gameId);
    },
    async saveServerEvents(gameId, list) {
      for (const event of list)
        events.set(event.id, {
          id: event.id,
          gameId,
          sequence: event.sequence,
          event,
          period: events.get(event.id)?.period ?? null,
          state: "synced",
        });
    },
    async addEvent(gameId, event, period) {
      if (events.has(event.id)) throw new Error("Event already stored.");
      events.set(event.id, {
        id: event.id,
        gameId,
        sequence: event.sequence,
        event,
        period,
        state: "pending",
      });
    },
    async markSynced(ids) {
      for (const id of ids) {
        const row = events.get(id);
        if (row) row.state = "synced";
      }
    },
    async discard(ids) {
      for (const id of ids) {
        const row = events.get(id);
        if (row) row.state = "discarded";
      }
    },
    async loadEvents(gameId) {
      return sorted(gameId).map(({ event, period, state }) => ({
        event,
        period,
        state,
      }));
    },
    dump: () => [...events.values()],
  };
}
