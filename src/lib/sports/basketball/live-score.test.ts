import { describe, expect, it } from "vitest";
import { formatClock } from "./live-score";

describe("game clock", () => {
  it("shows minutes and seconds, rounding up partial seconds", () => {
    expect(formatClock(252_000)).toBe("4:12");
    expect(formatClock(59_100)).toBe("1:00");
    expect(formatClock(0)).toBe("0:00");
  });
});
