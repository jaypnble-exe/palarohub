import { describe, expect, it } from "vitest";
import { registrationSchema, reviewSchema, sarToHalalas } from "./registration";
const id = "00000000-0000-4000-8000-000000000001";
describe("registration validation", () => {
  it("allows an empty draft roster", () =>
    expect(
      registrationSchema.safeParse({
        teamId: id,
        seasonId: id,
        divisionId: id,
        roster: [],
      }).success,
    ).toBe(true));
  it("rejects duplicate player IDs even with different jerseys", () =>
    expect(
      registrationSchema.safeParse({
        teamId: id,
        seasonId: id,
        divisionId: id,
        roster: [
          { playerId: id, jerseyNumber: 1 },
          { playerId: id, jerseyNumber: 2 },
        ],
      }).success,
    ).toBe(false));
  it("requires a reason when returning or rejecting a registration", () => {
    expect(
      reviewSchema.safeParse({
        registrationId: id,
        decision: "returned",
        comment: "",
      }).success,
    ).toBe(false);
    expect(
      reviewSchema.safeParse({
        registrationId: id,
        decision: "approved",
        comment: "",
      }).success,
    ).toBe(true);
  });
});
describe("SAR amounts", () => {
  it.each([
    ["1800", 180000],
    ["1800.50", 180050],
    ["0.01", 1],
    [" 12.3 ", 1230],
    ["0", 0],
  ])("converts %s to exact integer halalas", (amount, expected) =>
    expect(sarToHalalas(amount)).toBe(expected),
  );
  it.each(["-1", "0.001", "1e3", "abc", "1,800", "1000001"])(
    "rejects invalid amount %s",
    (amount) => expect(sarToHalalas(amount)).toBeNull(),
  );
});
