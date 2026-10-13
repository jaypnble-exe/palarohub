import { describe, expect, it } from "vitest";
import {
  mergeEvents,
  remainingOnScreen,
  scorerOffsetMs,
  type TvEventRow,
} from "./tv-feed";

const row = (
  sequence: number,
  occurredAt: string,
  createdAt: string,
): TvEventRow => ({
  id: `e0000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
  sequence,
  type: "score",
  payload: {},
  clockMs: null,
  occurredAt,
  createdAt,
});

describe("TV feed", () => {
  it("adds new actions in order without repeating any", () => {
    const one = row(1, "2026-10-23T16:00:00Z", "2026-10-23T16:00:01Z");
    const two = row(2, "2026-10-23T16:00:05Z", "2026-10-23T16:00:06Z");
    expect(
      mergeEvents([one], [two, one]).map((event) => event.sequence),
    ).toEqual([1, 2]);
  });

  it("estimates the scorer's clock difference from the quickest upload", () => {
    // The tablet runs 30 s slow; one action was sent late from offline.
    expect(
      scorerOffsetMs([
        row(1, "2026-10-23T16:00:00Z", "2026-10-23T16:00:30.400Z"),
        row(2, "2026-10-23T16:01:00Z", "2026-10-23T16:03:00Z"),
        row(3, "2026-10-23T16:02:00Z", "2026-10-23T16:02:30.200Z"),
      ]),
    ).toBe(30_200);
  });

  it("runs the clock on the server's time, whatever the devices say", () => {
    // Scorer started the clock with 5:00 left at its 16:00:00 (server 16:00:30).
    // This screen runs 10 s fast and it is now 16:00:50 on the server.
    expect(
      remainingOnScreen({
        remainingMs: 300_000,
        running: true,
        asOf: "2026-10-23T16:00:00Z",
        now: Date.parse("2026-10-23T16:01:00Z"),
        screenOffsetMs: -10_000,
        scorerOffset: 30_000,
      }),
    ).toBe(280_000);
    expect(
      remainingOnScreen({
        remainingMs: 300_000,
        running: false,
        asOf: "2026-10-23T16:00:00Z",
        now: Date.parse("2026-10-23T17:00:00Z"),
        screenOffsetMs: 0,
        scorerOffset: 0,
      }),
    ).toBe(300_000);
  });
});
