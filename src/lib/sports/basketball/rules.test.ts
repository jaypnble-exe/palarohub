import { describe, expect, it } from "vitest";
import { basketballRulesSchema, defaultBasketballRules } from "./index";

describe("basketball rule defaults", () => {
  it("uses the league defaults and standard timeout allowances", () => {
    expect(basketballRulesSchema.parse({})).toEqual({
      foulOut: 5,
      teamBonusAfter: 4,
      quarters: 4,
      quarterMinutes: 10,
      overtimeMinutes: 5,
      timeouts: { firstHalf: 2, secondHalf: 3, overtime: 1 },
      shotClock: { enabled: true, seconds: 24, resetSeconds: 14 },
    });
    expect(defaultBasketballRules).toEqual(basketballRulesSchema.parse({}));
  });
  it("fills nested defaults when one timeout allowance changes", () => {
    expect(
      basketballRulesSchema.parse({ timeouts: { firstHalf: 1 } }).timeouts,
    ).toEqual({ firstHalf: 1, secondHalf: 3, overtime: 1 });
  });
  it("enables the clock for legacy rules, including a saved disabled flag", () => {
    expect(
      basketballRulesSchema.parse({ shotClock: { enabled: false } }).shotClock,
    ).toEqual({ enabled: true, seconds: 24, resetSeconds: 14 });
    expect(
      basketballRulesSchema.parse({
        shotClock: { enabled: false, seconds: 30, resetSeconds: 14 },
      }).shotClock,
    ).toEqual({ enabled: true, seconds: 30, resetSeconds: 14 });
  });
  it.each([
    { foulOut: 0 },
    { quarters: 2.5 },
    { timeouts: { overtime: -1 } },
    { unknownRule: true },
  ])("rejects invalid rules %j", (rules) => {
    expect(basketballRulesSchema.safeParse(rules).success).toBe(false);
  });
});
