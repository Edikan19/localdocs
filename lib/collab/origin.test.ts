import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./origin";

describe("isAllowedOrigin", () => {
  it("accepts the same host", () => {
    expect(isAllowedOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
  });

  it("accepts a LAN address that matches the host", () => {
    expect(
      isAllowedOrigin("http://172.24.170.59:3000", "172.24.170.59:3000"),
    ).toBe(true);
  });

  it("rejects a different site", () => {
    expect(isAllowedOrigin("https://evil.example", "localhost:3000")).toBe(false);
  });

  it("rejects the same hostname on a different port", () => {
    expect(isAllowedOrigin("http://localhost:4000", "localhost:3000")).toBe(false);
  });

  it("rejects a missing Origin header", () => {
    expect(isAllowedOrigin(undefined, "localhost:3000")).toBe(false);
  });

  it("rejects a malformed Origin header", () => {
    expect(isAllowedOrigin("not a url", "localhost:3000")).toBe(false);
  });

  it("accepts an allowlisted origin even if the host differs", () => {
    expect(
      isAllowedOrigin("https://docs.example.com", "internal:3000", [
        "https://docs.example.com",
      ]),
    ).toBe(true);
  });
});