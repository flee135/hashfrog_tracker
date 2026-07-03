import { joinChecksStrings, splitChecksStrings } from "./checks-string";

describe("checks-string packing", () => {
  it("is identity for a single field (OoT stays unchanged)", () => {
    expect(joinChecksStrings(["abc123"])).toBe("abc123");
    expect(splitChecksStrings("abc123", 1)).toEqual(["abc123"]);
  });

  it("round-trips multiple fields through the settings_string slot", () => {
    const values = ["40c-bfff", "3fff-7f00"];
    expect(splitChecksStrings(joinChecksStrings(values), 2)).toEqual(values);
  });

  it("pads missing fields with empty strings", () => {
    expect(splitChecksStrings("only", 2)).toEqual(["only", ""]);
    expect(splitChecksStrings("", 2)).toEqual(["", ""]);
  });
});
