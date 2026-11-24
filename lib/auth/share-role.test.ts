import { describe, expect, it } from "vitest";
import { parseShareRole } from "./validation";

describe("parseShareRole", () => {
  it("accepts editor and viewer", () => {
    expect(parseShareRole("editor")).toBe("editor");
    expect(parseShareRole("viewer")).toBe("viewer");
  });

  it("rejects everything else, including owner", () => {
    expect(parseShareRole("owner")).toBeNull();
    expect(parseShareRole("EDITOR")).toBeNull();
    expect(parseShareRole("")).toBeNull();
    expect(parseShareRole(undefined)).toBeNull();
  });
});