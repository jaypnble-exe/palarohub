import { describe, expect, it } from "vitest";
import {
  parseGameEvents,
  scorerSetupSchema,
  toRecordedEvent,
} from "./game-events";
import {
  reduceBasketballGame,
  defaultBasketballRules,
} from "./sports/basketball";
import type { Json } from "./supabase/database.types";

const row = (sequence: number, type: string, payload: Json) => ({
  id: `99000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
  sequence,
  type,
  payload,
  clock_ms: null,
  occurred_at: "2026-10-23T16:00:00+00:00",
});
const player = "97000000-0000-4000-8000-000000000001";

describe("stored game events", () => {
  it("parses rows for the reducer and reports malformed ones", () => {
    const { events, invalid } = parseGameEvents("basketball", [
      row(1, "roster", {
        team: "home",
        players: [{ playerId: player, name: "Juan", jersey: 7 }],
      }),
      row(2, "checkin", { team: "home", playerId: player }),
      row(3, "score", {
        team: "home",
        playerId: player,
        points: 5,
        made: true,
      }),
      row(4, "dunk_contest", {}),
    ]);
    expect(events.map((event) => event.type)).toEqual(["roster", "checkin"]);
    expect(invalid).toEqual([row(3, "", {}).id, row(4, "", {}).id]);
    const state = reduceBasketballGame(events, defaultBasketballRules);
    expect(state.teams.home.players[player].present).toBe(true);
  });

  it("round-trips an event into the save format", () => {
    const [event] = parseGameEvents("basketball", [
      row(1, "timeout", { team: "away" }),
    ]).events;
    expect(toRecordedEvent(event, 2)).toEqual({
      id: row(1, "", {}).id,
      sequence: 1,
      type: "timeout",
      payload: { team: "away" },
      clockMs: null,
      period: 2,
      occurredAt: "2026-10-23T16:00:00+00:00",
    });
  });

  it("validates scorer setup and fills rule defaults", () => {
    const team = (name: string) => ({
      seasonTeamId: "96000000-0000-4000-8000-000000000001",
      name,
      players: [{ playerId: player, name: "Juan", jersey: 7 }],
    });
    const setup = scorerSetupSchema.parse({
      gameId: "98000000-0000-4000-8000-000000000001",
      leagueId: "92000000-0000-4000-8000-000000000001",
      leagueName: "Sindikato",
      seasonName: "Cup",
      divisionName: "Open",
      sport: "basketball",
      rules: { foulOut: 6 },
      scheduledAt: null,
      venue: "Main court",
      status: "scheduled",
      teams: { home: team("Royals"), away: team("Hawks") },
    });
    expect(setup.rules.foulOut).toBe(6);
    expect(setup.rules.quarters).toBe(4);
    expect(() =>
      scorerSetupSchema.parse({ ...setup, sport: "curling" }),
    ).toThrow();
  });
});
