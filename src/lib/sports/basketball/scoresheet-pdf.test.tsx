import { describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";
import type { GameRecord } from "@/lib/game-record";
import {
  defaultBasketballRules,
  reduceBasketballGame,
  summarizeBasketballGame,
  type BasketballEvent,
} from "./index";
import { BasketballScoresheet } from "./scoresheet-pdf";

vi.mock("server-only", () => ({}));

const id = (prefix: string, n: number) =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function playedGame(): BasketballEvent[] {
  let sequence = 0;
  const events: BasketballEvent[] = [];
  const add = (type: string, payload: object) =>
    events.push({
      id: id("e", ++sequence),
      sequence,
      clockMs: null,
      createdAt: "2026-10-23T16:00:00.000Z",
      type,
      payload,
    } as BasketballEvent);
  for (const [team, prefix, name] of [
    ["home", "1", "Royal"],
    ["away", "2", "Hawk"],
  ] as const) {
    const players = Array.from({ length: 8 }, (_, i) => ({
      playerId: id(prefix, i + 1),
      name: `${name} Dela Cruz ${i + 1}`,
      jersey: i * 3 + 4,
    }));
    add("roster", { team, players });
    for (const player of players)
      add("checkin", { team, playerId: player.playerId });
    add("starters", {
      team,
      playerIds: players.slice(0, 5).map((player) => player.playerId),
    });
  }
  add("officials", {
    referees: ["Ref Santos", "Ref Reyes"],
    scorer: "Mia",
    timekeeper: "Carlo",
  });
  for (let period = 1; period <= 4; period++) {
    add("period_start", {});
    for (let i = 0; i < 6; i++) {
      add("score", {
        team: "home",
        playerId: id("1", (i % 5) + 1),
        points: i % 3 === 0 ? 3 : 2,
        made: true,
      });
      add("score", {
        team: "away",
        playerId: id("2", (i % 5) + 1),
        points: 2,
        made: i !== 2,
      });
    }
    add("foul", { team: "home", playerId: id("1", 1), kind: "personal" });
    add("foul", { team: "away", playerId: id("2", period), kind: "personal" });
    if (period === 2)
      add("foul", { team: "away", playerId: id("2", 5), kind: "technical" });
    add("timeout", { team: period % 2 ? "home" : "away" });
    add("period_end", {});
  }
  add("game_end", {});
  return events;
}

describe("PDF scoresheet", () => {
  it("renders an approved game as a PDF", async () => {
    const events = playedGame();
    const rules = defaultBasketballRules;
    const state = reduceBasketballGame(events, rules);
    const teamNames = { home: "Riyadh Royals", away: "Hail Hawks" };
    const record = {
      game: {
        id: id("9", 1),
        leagueId: id("8", 1),
        status: "approved",
        scheduledAt: "2026-10-23T16:00:00.000Z",
        venue: "Main court",
        round: 1,
      },
      leagueName: "Sindikato",
      seasonName: "Sindikato Cup 2026",
      divisionName: "Division B",
      sport: "basketball",
      rules,
      teamNames,
      events,
      lastSequence: events.length,
      unreadableEvents: 0,
      state,
      summary: summarizeBasketballGame(state, teamNames),
      result: null,
      reviews: [],
    } as unknown as GameRecord;
    const pdf = await renderToBuffer(
      <BasketballScoresheet
        record={record}
        when="Oct 23, 2026, 7:00 PM"
        approvedAt="Oct 24, 2026, 9:00 AM"
        t={(key, values) =>
          `${key}${values ? ` ${Object.values(values).join(" ")}` : ""}`
        }
      />,
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
    if (process.env.SCORESHEET_PREVIEW)
      writeFileSync(process.env.SCORESHEET_PREVIEW, pdf);
  });
});
