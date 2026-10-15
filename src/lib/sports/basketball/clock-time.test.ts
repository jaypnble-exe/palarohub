import { describe, expect, it } from "vitest";
import { formatClockTime, parseClockTime } from "./clock-time";

describe("clock correction time", () => {
  it.each([
    ["02:35.4", 155400],
    ["2:35", 155000],
    ["00:00.0", 0],
    ["10:00.0", 600000],
  ] as const)("parses and formats %s", (input, ms) => {
    expect(parseClockTime(input)).toBe(ms);
    expect(parseClockTime(formatClockTime(ms))).toBe(ms);
  });
  it.each(["", "2:60", "-1:00", "02:35.45", "NaN", "2:5", "1e2:00"])(
    "rejects invalid time %s",
    (input) => {
      expect(parseClockTime(input)).toBeNull();
    },
  );
});
