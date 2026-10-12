import { describe, expect, it } from "vitest";
import {
  addGameSchema,
  announcementSchema,
  gameUpdateSchema,
  scheduleSetupSchema,
} from "./schedule";

const id = "84000000-0000-4000-8000-000000000001";
const other = "84000000-0000-4000-8000-000000000002";
const setup = {
  divisionId: id,
  twice: false,
  startDate: "2026-10-23",
  gameDays: [5],
  times: ["19:00"],
  venues: ["Main court"],
  replace: false,
};
const message = (result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) => result.error?.issues[0]?.message;

describe("schedule validation", () => {
  it("accepts a simple setup and rejects unclear slots", () => {
    expect(scheduleSetupSchema.safeParse(setup).success).toBe(true);
    expect(
      message(scheduleSetupSchema.safeParse({ ...setup, gameDays: [] })),
    ).toBe("pickGameDay");
    expect(
      message(scheduleSetupSchema.safeParse({ ...setup, times: ["7pm"] })),
    ).toBe("invalidTime");
    expect(
      message(
        scheduleSetupSchema.safeParse({
          ...setup,
          venues: ["Court 1", " court 1 "],
        }),
      ),
    ).toBe("duplicateVenue");
    expect(
      scheduleSetupSchema.safeParse({ ...setup, extra: true }).success,
    ).toBe(false);
  });

  it("only lets postponed games go without a date", () => {
    const update = { gameId: id, venue: "Gym", scheduledAt: null };
    expect(
      gameUpdateSchema.safeParse({ ...update, status: "postponed" }).success,
    ).toBe(true);
    expect(
      message(gameUpdateSchema.safeParse({ ...update, status: "scheduled" })),
    ).toBe("timeRequired");
  });

  it("needs two different teams for an extra game", () => {
    const game = {
      divisionId: id,
      homeTeamId: other,
      awayTeamId: other,
      scheduledAt: "2026-10-23T16:00:00.000Z",
      venue: "",
    };
    expect(message(addGameSchema.safeParse(game))).toBe("sameTeam");
    expect(addGameSchema.safeParse({ ...game, awayTeamId: id }).success).toBe(
      true,
    );
  });

  it("trims announcements and requires both title and message", () => {
    expect(
      announcementSchema.parse({
        title: " Hi ",
        body: " Text ",
        divisionId: null,
      }),
    ).toEqual({ title: "Hi", body: "Text", divisionId: null });
    expect(
      announcementSchema.safeParse({ title: "  ", body: "x", divisionId: null })
        .success,
    ).toBe(false);
  });
});
