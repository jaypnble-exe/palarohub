import { describe, expect, it } from "vitest";
import { teamImageFormat } from "./team-media";
describe("uploaded image format", () => {
  it("recognizes supported image signatures independently of filenames", () => {
    expect(
      teamImageFormat(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))?.mime,
    ).toBe("image/png");
    expect(teamImageFormat(new Uint8Array([255, 216, 255]))?.mime).toBe(
      "image/jpeg",
    );
    expect(
      teamImageFormat(new TextEncoder().encode("RIFF0000WEBP"))?.mime,
    ).toBe("image/webp");
  });
  it("rejects markup, renamed documents and empty files", () => {
    for (const value of [
      "<svg></svg>",
      "<script>alert(1)</script>",
      "%PDF-1.7",
      "",
    ])
      expect(teamImageFormat(new TextEncoder().encode(value))).toBeNull();
  });
});
