import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import tl from "@/messages/tl.json";

function keys(value: object, prefix = ""): string[] {
  return Object.entries(value)
    .flatMap(([key, entry]) => {
      const path = `${prefix}${key}`;
      return typeof entry === "object" && entry !== null
        ? keys(entry, `${path}.`)
        : [path];
    })
    .sort();
}

describe("translations", () => {
  it("provides every English message in Tagalog", () => {
    expect(keys(tl)).toEqual(keys(en));
  });
});
