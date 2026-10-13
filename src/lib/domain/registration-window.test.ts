import { describe, expect, it } from "vitest";
import {
  daysLeft,
  deadlineInDays,
  registrationState,
} from "./registration-window";

const now = new Date("2026-10-13T10:00:00Z"); // 1:00 PM in Riyadh

describe("registration window", () => {
  it("is open only when switched on and before the deadline", () => {
    expect(
      registrationState(
        { isOpen: true, deadline: "2026-10-20T20:59:00Z" },
        now,
      ),
    ).toBe("open");
    expect(
      registrationState(
        { isOpen: false, deadline: "2026-10-20T20:59:00Z" },
        now,
      ),
    ).toBe("closed");
    expect(
      registrationState(
        { isOpen: true, deadline: "2026-10-13T10:00:00Z" },
        now,
      ),
    ).toBe("ended");
    expect(registrationState(null, now)).toBe("notSetUp");
  });
  it("sets quick deadlines to 11:59 PM Saudi time", () => {
    expect(deadlineInDays(now, 7)).toBe("2026-10-20T20:59:00.000Z");
    // Just after midnight in Riyadh is already the next Saudi day.
    expect(deadlineInDays(new Date("2026-10-13T21:30:00Z"), 0)).toBe(
      "2026-10-14T20:59:00.000Z",
    );
  });
  it("counts whole days left and never goes below zero", () => {
    expect(daysLeft("2026-10-20T20:59:00Z", now)).toBe(8);
    expect(daysLeft("2026-10-01T00:00:00Z", now)).toBe(0);
  });
});
