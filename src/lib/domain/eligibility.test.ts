import { describe, expect, it } from "vitest";
import {
  checkRosterEligibility,
  currentPlayerRating,
  registrationIsOpen,
  type EligibilityPlayer,
  type EligibilityRules,
} from "./eligibility";

const rules: EligibilityRules = {
  ratingScale: ["A", "B", "C", "D"],
  maximumRating: "C",
  rosterMin: 2,
  rosterMax: 3,
  requireDocuments: false,
};
const player: EligibilityPlayer = {
  id: "one",
  name: "Juan Dela Cruz",
  rating: "C",
  jerseyNumber: 7,
  suspended: false,
  documentsPresent: false,
  onAnotherTeam: false,
};
const roster = [
  player,
  { ...player, id: "two", name: "Pedro Santos", rating: "D", jerseyNumber: 8 },
];
describe("roster eligibility", () => {
  it("allows maximum and lower ratings", () =>
    expect(checkRosterEligibility(roster, rules)).toEqual([]));
  it("reports the player's name and rating when rated too high", () =>
    expect(
      checkRosterEligibility([{ ...player, rating: "A" }, roster[1]], rules),
    ).toContainEqual({
      code: "ratingTooHigh",
      playerId: "one",
      name: "Juan Dela Cruz",
      rating: "A",
      maximumRating: "C",
    }));
  it("does not guess when a rating is absent or outside the season scale", () => {
    expect(
      checkRosterEligibility([{ ...player, rating: null }, roster[1]], rules)[0]
        .code,
    ).toBe("ratingMissing");
    expect(
      checkRosterEligibility(
        [{ ...player, rating: "ELITE" }, roster[1]],
        rules,
      )[0].code,
    ).toBe("ratingUnknown");
  });
  it("uses the configured order for custom labels", () =>
    expect(
      checkRosterEligibility([{ ...player, rating: "SOCIAL" }], {
        ...rules,
        rosterMin: 1,
        ratingScale: ["ELITE", "CLUB", "SOCIAL"],
        maximumRating: "CLUB",
      }),
    ).toEqual([]));
  it("enforces minimum and maximum roster sizes", () => {
    expect(checkRosterEligibility([], rules)).toEqual([
      { code: "rosterTooSmall", min: 2 },
    ]);
    expect(
      checkRosterEligibility(
        [
          ...roster,
          { ...player, id: "three", jerseyNumber: 3 },
          { ...player, id: "four", jerseyNumber: 4 },
        ],
        rules,
      ),
    ).toEqual([{ code: "rosterTooLarge", max: 3 }]);
  });
  it("rejects duplicate players and jersey numbers", () => {
    expect(
      checkRosterEligibility([player, player], rules).map(
        (issue) => issue.code,
      ),
    ).toEqual(["duplicatePlayer", "duplicateJersey"]);
  });
  it("reports suspension, missing required documents, and another team", () =>
    expect(
      checkRosterEligibility(
        [{ ...player, suspended: true, onAnotherTeam: true }, roster[1]],
        { ...rules, requireDocuments: true },
      ).map((issue) => issue.code),
    ).toEqual([
      "playerSuspended",
      "documentsMissing",
      "anotherTeam",
      "documentsMissing",
    ]));
  it("does not require documents when the commissioner disables the requirement", () =>
    expect(checkRosterEligibility(roster, rules)).toEqual([]));
});
describe("rating history", () => {
  const history = [
    {
      id: "one",
      rating: "C",
      effectiveFrom: "2026-09-01T00:00:00Z",
      createdAt: "2026-09-01T00:00:00Z",
    },
    {
      id: "two",
      rating: "B",
      effectiveFrom: "2026-10-01T00:00:00Z",
      createdAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "three",
      rating: "A",
      effectiveFrom: "2027-01-01T00:00:00Z",
      createdAt: "2026-10-02T00:00:00Z",
    },
  ];
  it("selects the most recent effective rating and excludes future changes", () => {
    expect(currentPlayerRating(history, "2026-10-12T12:00:00Z")?.rating).toBe(
      "B",
    );
    expect(currentPlayerRating(history, "2026-09-15T00:00:00Z")?.rating).toBe(
      "C",
    );
    expect(currentPlayerRating(history, "2026-08-01T00:00:00Z")).toBeNull();
  });
  it("does not reorder the caller's history", () => {
    currentPlayerRating(history, "2026-10-12T12:00:00Z");
    expect(history.map((entry) => entry.id)).toEqual(["one", "two", "three"]);
  });
  it("resolves equal effective times deterministically", () => {
    expect(
      currentPlayerRating(
        [
          ...history,
          {
            ...history[1],
            id: "four",
            rating: "D",
            createdAt: "2026-10-02T00:00:00Z",
          },
        ],
        "2026-10-12T12:00:00Z",
      )?.rating,
    ).toBe("D");
  });
});
describe("registration deadline", () => {
  const settings = { isOpen: true, deadline: "2026-11-01T18:00:00Z" };
  it("locks at the exact deadline", () => {
    expect(registrationIsOpen(settings, "2026-11-01T17:59:59Z")).toBe(true);
    expect(registrationIsOpen(settings, settings.deadline)).toBe(false);
  });
  it("respects the commissioner's closed switch", () =>
    expect(
      registrationIsOpen(
        { ...settings, isOpen: false },
        "2026-10-12T12:00:00Z",
      ),
    ).toBe(false));
});
