import { describe, expect, it } from "vitest";
import { safeNextPath } from "./auth";
import { leagueSchema, reservedSlugs } from "./leagues";

describe("auth redirect", () => {
  it("preserves a local league destination", () => {
    expect(safeNextPath("/admin/sindikato?tab=home")).toBe(
      "/admin/sindikato?tab=home",
    );
  });
  it.each([
    "//evil.test",
    "https://evil.test",
    "/\\evil.test",
    "/login",
    "/auth/callback",
    "/\nevil.test",
    undefined,
  ])("rejects unsafe or looping destination %s", (value) => {
    expect(safeNextPath(value)).toBe("/leagues");
  });
});
describe("league validation", () => {
  const league = {
    name: "Sindikato",
    slug: "sindikato",
    sport: "basketball",
    commissionerEmail: "member@example.test",
  };
  it.each(reservedSlugs)("reserves %s", (slug) => {
    expect(leagueSchema.safeParse({ ...league, slug }).success).toBe(false);
  });
  it("rejects sports that are not implemented", () => {
    expect(
      leagueSchema.safeParse({ ...league, sport: "volleyball" }).success,
    ).toBe(false);
  });
  it("accepts a valid league", () => {
    expect(leagueSchema.parse(league)).toEqual(league);
  });
});
