import { describe, expect, it } from "vitest";
import { resolveLocale } from "./locales";

describe("language cookie", () => {
  it.each(["en", "tl"] as const)("accepts %s", (locale) => {
    expect(resolveLocale(locale)).toBe(locale);
  });

  it.each([undefined, "", "fr", "../../secrets"])(
    "falls back to English for unsupported value %s",
    (value) => {
      expect(resolveLocale(value)).toBe("en");
    },
  );
});
