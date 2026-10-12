import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { reconcileEvents } from "./reconcile";
import { createScorebookStore } from "./scorebook-store";

const event = (sequence: number, id = `e-${sequence}`) => ({ id, sequence });
const parse = (value: unknown) =>
  value && typeof value === "object" && "id" in value
    ? (value as ReturnType<typeof event>)
    : null;
let databases = 0;
const store = () => createScorebookStore(`test-scorebook-${++databases}`);

describe("scorer device storage", () => {
  it("keeps unsent actions across page loads, per game", async () => {
    const first = store();
    await first.saveSetup("game-1", { teams: "cached" });
    await first.saveServerEvents("game-1", [event(1), event(2)]);
    await first.addEvent("game-1", event(3), 1);
    await first.addEvent("game-2", event(1, "other-game"), null);
    expect(await first.loadSetup("game-1")).toEqual({ teams: "cached" });
    expect(await first.loadEvents("game-1")).toEqual([
      { event: event(1), period: null, state: "synced" },
      { event: event(2), period: null, state: "synced" },
      { event: event(3), period: 1, state: "pending" },
    ]);
    await first.markSynced(["e-3"]);
    expect((await first.loadEvents("game-1")).at(-1)?.state).toBe("synced");
    expect(await first.loadEvents("game-2")).toHaveLength(1);
  });

  it("refuses to store the same action twice", async () => {
    const db = store();
    await db.addEvent("game-1", event(1), 1);
    await expect(db.addEvent("game-1", event(1), 1)).rejects.toThrow();
  });

  it("keeps the period when the server confirms an action", async () => {
    const db = store();
    await db.addEvent("game-1", event(5), 2);
    await db.saveServerEvents("game-1", [event(5)]);
    expect(await db.loadEvents("game-1")).toEqual([
      { event: event(5), period: 2, state: "synced" },
    ]);
  });

  it("sets aside actions that can no longer be sent without deleting them", async () => {
    const db = store();
    await db.addEvent("game-1", event(4), 1);
    await db.discard(["e-4"]);
    expect(await db.loadEvents("game-1")).toEqual([
      { event: event(4), period: 1, state: "discarded" },
    ]);
  });
});

describe("reconciling device and server events", () => {
  it("adds unsent device actions after the server's events", () => {
    const result = reconcileEvents(
      [event(1), event(2)],
      [
        { event: event(4), period: 1, state: "pending" },
        { event: event(3), period: 1, state: "pending" },
        { event: event(1), period: null, state: "synced" },
      ],
      parse,
    );
    expect(result.events.map((item) => item.sequence)).toEqual([1, 2, 3, 4]);
    expect(result.pending.map(({ event: item }) => item.id)).toEqual([
      "e-3",
      "e-4",
    ]);
    expect(result.conflicts).toEqual([]);
  });

  it("recognises actions the server saved when the reply was lost", () => {
    const result = reconcileEvents(
      [event(1), event(2)],
      [{ event: event(2), period: 1, state: "pending" }],
      parse,
    );
    expect(result.alreadySaved).toEqual(["e-2"]);
    expect(result.pending).toEqual([]);
    expect(result.events).toHaveLength(2);
  });

  it("holds back actions whose number another device already used", () => {
    const result = reconcileEvents(
      [event(1), event(2, "from-other-device")],
      [
        { event: event(2), period: 1, state: "pending" },
        { event: event(3), period: 1, state: "pending" },
      ],
      parse,
    );
    expect(result.conflicts.map((item) => item.id)).toEqual(["e-2"]);
    expect(result.pending.map(({ event: item }) => item.id)).toEqual(["e-3"]);
    expect(result.events.map((item) => item.id)).toEqual([
      "e-1",
      "from-other-device",
      "e-3",
    ]);
  });

  it("ignores set-aside and unreadable device actions", () => {
    const result = reconcileEvents(
      [],
      [
        { event: event(1), period: 1, state: "discarded" },
        { event: "garbage", period: 1, state: "pending" },
      ],
      parse,
    );
    expect(result.events).toEqual([]);
  });
});
