import { describe, expect, it } from "vitest";
import { buildSchedule, roundRobinPairings } from "./round-robin";

const teams = (count: number) =>
  Array.from({ length: count }, (_, index) => `team-${index + 1}`);
const pairKey = (a: string, b: string) => [a, b].sort().join("|");

describe("round-robin pairings", () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16])(
    "%i teams meet each other exactly once, once per round",
    (count) => {
      const pairings = roundRobinPairings(teams(count));
      const rounds = count % 2 ? count : count - 1;
      expect(pairings).toHaveLength((count * (count - 1)) / 2);
      expect(new Set(pairings.map((game) => game.round)).size).toBe(rounds);
      expect(
        new Set(
          pairings.map((game) => pairKey(game.homeTeamId, game.awayTeamId)),
        ).size,
      ).toBe(pairings.length);
      for (let round = 1; round <= rounds; round++) {
        const playing = pairings
          .filter((game) => game.round === round)
          .flatMap((game) => [game.homeTeamId, game.awayTeamId]);
        expect(new Set(playing).size).toBe(playing.length);
        // Odd team counts give exactly one bye per round.
        expect(playing.length).toBe(count % 2 ? count - 1 : count);
      }
    },
  );

  it.each([4, 5, 6, 7, 8, 10, 12])(
    "%i teams get balanced home games",
    (count) => {
      const pairings = roundRobinPairings(teams(count));
      for (const team of teams(count)) {
        const home = pairings.filter((game) => game.homeTeamId === team).length;
        const away = pairings.filter((game) => game.awayTeamId === team).length;
        expect(Math.abs(home - away)).toBeLessThanOrEqual(1);
      }
    },
  );

  it("plays a second leg with home and away swapped", () => {
    const pairings = roundRobinPairings(teams(4), true);
    expect(pairings).toHaveLength(12);
    const firstLeg = pairings.filter((game) => game.round <= 3);
    const secondLeg = pairings.filter((game) => game.round > 3);
    expect(
      secondLeg.map((game) => `${game.awayTeamId}-${game.homeTeamId}`).sort(),
    ).toEqual(
      firstLeg.map((game) => `${game.homeTeamId}-${game.awayTeamId}`).sort(),
    );
    for (const team of teams(4))
      expect(pairings.filter((game) => game.homeTeamId === team)).toHaveLength(
        3,
      );
  });

  it("needs at least two teams", () => {
    expect(roundRobinPairings(["only"])).toEqual([]);
  });
});

describe("schedule placement", () => {
  const fridays = {
    startDate: "2026-10-21", // a Wednesday
    gameDays: [5],
    times: ["20:30", "19:00"],
    venues: ["Main court"],
  };

  it("fills Friday slots in Riyadh time, earliest first", () => {
    const result = buildSchedule(teams(4), false, fridays);
    if ("error" in result) throw new Error(result.error);
    expect(result.games).toHaveLength(6);
    expect(result.games.slice(0, 2).map((game) => game.scheduledAt)).toEqual([
      "2026-10-23T16:00:00.000Z",
      "2026-10-23T17:30:00.000Z",
    ]);
    expect(result.lastDate).toBe("2026-11-06");
    expect(result.gameDayCount).toBe(3);
    expect(result.games.every((game) => game.venue === "Main court")).toBe(
      true,
    );
  });

  it("never schedules a team twice on one day", () => {
    const result = buildSchedule(teams(7), true, {
      ...fridays,
      gameDays: [4, 5],
      times: ["18:00", "19:30", "21:00"],
      venues: ["Court 1", "Court 2"],
    });
    if ("error" in result) throw new Error(result.error);
    expect(result.games).toHaveLength(42);
    const byDay = new Map<string, string[]>();
    for (const game of result.games) {
      const day = game.scheduledAt.slice(0, 10);
      byDay.set(day, [
        ...(byDay.get(day) ?? []),
        game.homeTeamId,
        game.awayTeamId,
      ]);
    }
    for (const playing of byDay.values())
      expect(new Set(playing).size).toBe(playing.length);
    const slots = result.games.map(
      (game) => `${game.scheduledAt}|${game.venue}`,
    );
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("uses several courts at the same time", () => {
    const result = buildSchedule(teams(4), false, {
      ...fridays,
      times: ["19:00"],
      venues: ["Court 1", "Court 2"],
    });
    if ("error" in result) throw new Error(result.error);
    expect(result.gameDayCount).toBe(3);
    expect(result.games.slice(0, 2).map((game) => game.venue)).toEqual([
      "Court 1",
      "Court 2",
    ]);
  });

  it("explains why a schedule cannot be made", () => {
    expect(buildSchedule(["solo"], false, fridays)).toEqual({
      error: "notEnoughTeams",
    });
    expect(buildSchedule(["a", "a"], false, fridays)).toEqual({
      error: "notEnoughTeams",
    });
    expect(
      buildSchedule(teams(4), false, { ...fridays, gameDays: [] }),
    ).toEqual({ error: "noSlots" });
    expect(buildSchedule(teams(4), false, { ...fridays, venues: [] })).toEqual({
      error: "noSlots",
    });
    expect(
      buildSchedule(teams(4), false, { ...fridays, times: ["25:00"] }),
    ).toEqual({ error: "noSlots" });
    expect(buildSchedule(teams(41), false, fridays)).toEqual({
      error: "tooLong",
    });
  });
});
