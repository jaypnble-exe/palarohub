import { describe, expect, it } from "vitest";
import { fromRiyadhDateTimeInput, toRiyadhDateTimeInput } from "./riyadh-time";
describe("Riyadh form dates", () => {
  it("round-trips a Saudi evening to UTC", () => {
    expect(toRiyadhDateTimeInput("2026-11-01T18:30:00Z")).toBe(
      "2026-11-01T21:30",
    );
    expect(fromRiyadhDateTimeInput("2026-11-01T21:30")).toBe(
      "2026-11-01T18:30:00.000Z",
    );
  });
  it("rejects impossible dates and extra offsets", () => {
    expect(fromRiyadhDateTimeInput("2026-02-30T12:00")).toBeNull();
    expect(fromRiyadhDateTimeInput("2026-11-01T21:30+02:00")).toBeNull();
  });
});
