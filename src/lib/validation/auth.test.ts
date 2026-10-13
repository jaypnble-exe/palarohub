import { describe, expect, it } from "vitest";
import {
  newPasswordSchema,
  safeNextPath,
  signInSchema,
  signUpSchema,
} from "./auth";
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

describe("password rules", () => {
  it("needs a name, a valid email, and at least 8 characters to sign up", () => {
    const account = {
      name: "Juan",
      email: "juan@example.test",
      password: "12345678",
    };
    expect(signUpSchema.safeParse(account).success).toBe(true);
    expect(
      signUpSchema.safeParse({ ...account, password: "1234567" }).success,
    ).toBe(false);
    expect(signUpSchema.safeParse({ ...account, name: "  " }).success).toBe(
      false,
    );
    expect(signUpSchema.safeParse({ ...account, email: "juan" }).success).toBe(
      false,
    );
  });

  it("accepts any non-empty password when signing in", () => {
    expect(
      signInSchema.safeParse({ email: "a@b.test", password: "x" }).success,
    ).toBe(true);
    expect(
      signInSchema.safeParse({ email: "a@b.test", password: "" }).success,
    ).toBe(false);
  });

  it("requires the new password to be typed the same twice", () => {
    expect(
      newPasswordSchema.safeParse({
        password: "long-enough",
        confirm: "long-enough",
      }).success,
    ).toBe(true);
    const mismatch = newPasswordSchema.safeParse({
      password: "long-enough",
      confirm: "different",
    });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0]?.message).toBe("mismatch");
  });
});
