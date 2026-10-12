import { describe, expect, it } from "vitest";
import { allowedRatingLabels, isRatingAllowed } from "./ratings";
import { ratingScaleSchema, seasonSchema } from "@/lib/validation/seasons";
import { getSportModule } from "@/lib/sports/registry";

describe("ordered rating eligibility", () => {
  it("allows B and lower for a division capped at B", () => {
    expect(allowedRatingLabels(["A", "B", "C", "D"], "B")).toEqual([
      "B",
      "C",
      "D",
    ]);
    expect(isRatingAllowed(["A", "B", "C", "D"], "A", "B")).toBe(false);
    expect(isRatingAllowed(["A", "B", "C", "D"], "B", "B")).toBe(true);
    expect(isRatingAllowed(["A", "B", "C", "D"], "D", "B")).toBe(true);
  });
  it("works with custom labels and rejects unknown ratings", () => {
    expect(isRatingAllowed(["ELITE", "SOCIAL"], "SOCIAL", "SOCIAL")).toBe(true);
    expect(isRatingAllowed(["ELITE", "SOCIAL"], "UNKNOWN", "SOCIAL")).toBe(
      false,
    );
    expect(allowedRatingLabels(["ELITE", "SOCIAL"], "UNKNOWN")).toEqual([]);
  });
  it("normalizes labels before detecting duplicates", () => {
    expect(ratingScaleSchema.parse([" elite ", "social"])).toEqual([
      "ELITE",
      "SOCIAL",
    ]);
    expect(ratingScaleSchema.safeParse(["A", " a "]).success).toBe(false);
  });
});

describe("season setup validation", () => {
  const season = {
    name: "Community Cup",
    startDate: "2026-10-16",
    endDate: "2026-12-18",
    sport: "basketball",
    rules: getSportModule("basketball").defaultRules,
    ratingScale: ["A", "B", "C", "D"],
    status: "draft",
    divisions: [
      {
        name: "Division B",
        sport: "basketball",
        maxRating: "B",
        rosterMin: 8,
        rosterMax: 15,
        rules: null,
      },
    ],
  };
  it("accepts a valid setup", () => {
    expect(seasonSchema.safeParse(season).success).toBe(true);
  });
  it.each([
    { endDate: "2026-01-01" },
    { startDate: "2026-02-30" },
    { rules: { quarters: 0 } },
    { divisions: [] },
    { ratingScale: ["A", "A"] },
    { divisions: [{ ...season.divisions[0], maxRating: "ELITE" }] },
    { divisions: [{ ...season.divisions[0], rosterMax: 4 }] },
    {
      divisions: [
        season.divisions[0],
        { ...season.divisions[0], name: "division b" },
      ],
    },
    { divisions: [{ ...season.divisions[0], rules: { foulOut: -1 } }] },
  ])("rejects invalid setup %j", (change) => {
    expect(seasonSchema.safeParse({ ...season, ...change }).success).toBe(
      false,
    );
  });
});
