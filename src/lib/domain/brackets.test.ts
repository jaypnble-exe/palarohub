import { describe, expect, it } from "vitest";
import { buildBracket } from "./brackets";
describe("playoff brackets", () => {
  it("keeps top seeds in opposite halves", () => {
    const slots = buildBracket(8, "single");
    expect(
      slots.filter((s) => s.round === 1).map((s) => [s.homeSeed, s.awaySeed]),
    ).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]);
    expect(slots.at(-1)).toMatchObject({
      round: 3,
      homeSource: "2:1",
      awaySource: "2:2",
    });
  });
  it.each([2, 3, 5, 8, 16])(
    "builds a valid tree for %i teams, including byes",
    (count) => {
      const slots = buildBracket(count, "single");
      const keys = new Set(slots.map((s) => s.key));
      for (const slot of slots) {
        if (slot.homeSource) expect(keys.has(slot.homeSource)).toBe(true);
        if (slot.awaySource) expect(keys.has(slot.awaySource)).toBe(true);
      }
      const size = 2 ** Math.ceil(Math.log2(count));
      expect(slots).toHaveLength(size - 1);
      expect(
        slots.filter(
          (s) =>
            s.round === 1 &&
            ((s.homeSeed ?? 0) > count || (s.awaySeed ?? 0) > count),
        ),
      ).toHaveLength(size - count);
    },
  );
  it("applies twice-to-beat only in the first round", () => {
    expect(
      buildBracket(4, "twice").map((s) => [s.homeRequired, s.awayRequired]),
    ).toEqual([
      [1, 2],
      [1, 2],
      [1, 1],
    ]);
    expect(
      buildBracket(4, "best3").every(
        (s) => s.homeRequired === 2 && s.awayRequired === 2,
      ),
    ).toBe(true);
    expect(
      buildBracket(4, "best5").every(
        (s) => s.homeRequired === 3 && s.awayRequired === 3,
      ),
    ).toBe(true);
  });
  it.each([0, 1, 17, 3.5])(
    "rejects unsupported qualifier counts %i",
    (count) => {
      expect(() => buildBracket(count, "single")).toThrow();
    },
  );
});
