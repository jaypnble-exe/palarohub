import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultBasketballRules } from "./rules";
import { reduceBasketballGame, validateBasketballEvent } from "./reducer";
import { summarizeBasketballGame } from "./summary";
import type { BasketballEvent } from "./events";
import { basketballLiveScore } from "./live-score";

const seed = readFileSync(join(process.cwd(), "supabase/seed.sql"), "utf8");

/** One demo game's events in supabase/seed.sql, by the game's event id prefix. */
function seededEvents(prefix: string): BasketballEvent[] {
  const row =
    /\('([0-9a-f-]{36})',(\d+),'([a-z_]+)','((?:[^']|'')*)'::jsonb,(null|\d+),(\d+),(\d+)\)/g;
  return [...seed.matchAll(row)]
    .filter((match) => match[1].startsWith(prefix))
    .map((match) => ({
      id: match[1],
      sequence: Number(match[2]),
      type: match[3],
      payload: JSON.parse(match[4].replaceAll("''", "'")),
      clockMs: match[5] === "null" ? null : Number(match[5]),
      // Times are relative in the seed; only their order matters here.
      createdAt: new Date(
        Date.UTC(2026, 9, 1) + Number(match[2]) * 1000,
      ).toISOString(),
    })) as BasketballEvent[];
}

function expectValid(events: BasketballEvent[]) {
  expect(events.length).toBeGreaterThan(50);
  events.forEach((event, index) => {
    const state = reduceBasketballGame(
      events.slice(0, index),
      defaultBasketballRules,
    );
    expect(
      validateBasketballEvent(state, event, defaultBasketballRules),
      `${event.type} #${event.sequence}`,
    ).toBeNull();
  });
  return reduceBasketballGame(events, defaultBasketballRules);
}

describe("seeded live game", () => {
  const events = seededEvents("e0000000-");
  it("follows the basketball rules event by event", () => expectValid(events));
  it("is paused in the third quarter with the Royals ahead", () => {
    const state = reduceBasketballGame(events, defaultBasketballRules);
    expect(state.phase).toBe("live");
    expect(state.period).toBe(3);
    expect(state.clock).toMatchObject({ running: false, remainingMs: 252000 });
    expect(basketballLiveScore(state, defaultBasketballRules)).toEqual({
      homeScore: 36,
      awayScore: 31,
      status: {
        key: "basketball.quarter",
        values: { period: 3, clock: "4:12" },
      },
    });
  });
});

describe.each([
  ["8", "Taif Titans", "Hail Hawks", true],
  ["9", "Yanbu Kings", "Riyadh Royals", true],
  ["10", "Taif Titans", "Yanbu Kings", false],
] as const)("seeded finished game %s", (number, home, away, approved) => {
  const events = seededEvents(`e${number.padStart(7, "0")}-`);
  const gameId = `c0000000-0000-4000-8000-${number.padStart(12, "0")}`;
  it("follows the rules to the final buzzer", () => {
    const state = expectValid(events);
    expect(state.phase).toBe("final");
    expect(state.winner).not.toBeNull();
  });
  it.runIf(approved)("stores the result approval would record", () => {
    const state = reduceBasketballGame(events, defaultBasketballRules);
    const summary = summarizeBasketballGame(state, { home, away })!;
    const stored = new RegExp(
      `values\\('${gameId}',l,(\\d+),(\\d+),(\\d+),'((?:[^']|'')*)'::jsonb`,
    ).exec(seed);
    expect(stored).not.toBeNull();
    expect(stored!.slice(1, 4).map(Number)).toEqual([
      summary.homeScore,
      summary.awayScore,
      events.length,
    ]);
    expect(JSON.parse(stored![4].replaceAll("''", "'"))).toEqual(
      JSON.parse(JSON.stringify(summary.summary)),
    );
  });
});
