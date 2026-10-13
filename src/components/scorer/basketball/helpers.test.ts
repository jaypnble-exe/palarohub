import { describe, expect, it } from "vitest";
import { splitName } from "./helpers";

describe("player names on tiles", () => {
  it("keeps Filipino and Spanish surname particles with the surname", () => {
    expect(splitName("Juan Dela Cruz")).toEqual({
      first: "Juan",
      last: "Dela Cruz",
    });
    expect(splitName("Ma. Clara de los Santos")).toEqual({
      first: "Ma. Clara",
      last: "de los Santos",
    });
    expect(splitName("Miguel Reyes")).toEqual({
      first: "Miguel",
      last: "Reyes",
    });
    expect(splitName("Jose San Juan")).toEqual({
      first: "Jose",
      last: "San Juan",
    });
  });
  it("treats one name as the surname", () =>
    expect(splitName("  Pele ")).toEqual({ first: "", last: "Pele" }));
});
