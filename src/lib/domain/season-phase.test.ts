import { describe, expect, it } from "vitest";
import { riyadhToday, seasonPhase, seasonWeek } from "./season-phase";

const season = {
  status: "published",
  start_date: "2026-10-01",
  end_date: "2026-12-24",
};

describe("season phase", () => {
  it("follows the status and the dates", () => {
    expect(seasonPhase({ ...season, status: "draft" }, "2026-10-13")).toBe(
      "draft",
    );
    expect(seasonPhase(season, "2026-09-30")).toBe("upcoming");
    expect(seasonPhase(season, "2026-10-01")).toBe("inProgress");
    expect(seasonPhase(season, "2026-12-24")).toBe("inProgress");
    expect(seasonPhase(season, "2026-12-25")).toBe("finished");
  });
  it("counts the week of a season in progress", () => {
    expect(seasonWeek(season, "2026-10-01")).toEqual({ current: 1, total: 12 });
    expect(seasonWeek(season, "2026-10-13")).toEqual({ current: 2, total: 12 });
    expect(seasonWeek(season, "2027-01-30")).toEqual({ current: 12, total: 12 });
  });
  it("uses the Saudi date", () =>
    expect(riyadhToday(new Date("2026-10-13T22:30:00Z"))).toBe("2026-10-14"));
});
