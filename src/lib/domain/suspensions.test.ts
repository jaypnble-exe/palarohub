import { describe, expect, it } from "vitest";
import { suspensionProgress, type ServedGame } from "./suspensions";

const suspension = {
  id: "s1",
  gameId: "g1",
  seasonTeamId: "royals",
  games: 2,
  createdAt: "2026-10-10T20:00:00Z",
  completed: false,
};
const game = (
  id: string,
  homeId: string,
  awayId: string,
  approvedAt: string,
): ServedGame => ({
  id,
  homeId,
  awayId,
  approvedAt,
});

describe("suspension progress", () => {
  it("counts the team's games after the ejection, not the ejection game", () => {
    expect(
      suspensionProgress(suspension, [
        game("g1", "royals", "kings", "2026-10-10T20:00:00Z"),
        game("g2", "titans", "royals", "2026-10-17T20:00:00Z"),
        game("g3", "titans", "hawks", "2026-10-18T20:00:00Z"),
      ]),
    ).toEqual({ served: 1, total: 2, left: 1, done: false });
  });
  it("is done once enough games are played, or when the database says so", () => {
    const games = [
      game("g2", "royals", "titans", "2026-10-17T20:00:00Z"),
      game("g4", "hawks", "royals", "2026-10-24T20:00:00Z"),
    ];
    expect(suspensionProgress(suspension, games).done).toBe(true);
    expect(
      suspensionProgress({ ...suspension, completed: true }, []).left,
    ).toBe(0);
  });
});
