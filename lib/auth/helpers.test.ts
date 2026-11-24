import { describe, expect, it } from "vitest";
import { readCookie } from "./cookies";
import {
  cleanName,
  normalizeEmail,
  passwordProblem,
  safeNextPath,
} from "./validation";
import { createRateLimiter } from "./rate-limit";
import { canEdit } from "./roles";

describe("readCookie", () => {
  it("finds a cookie among several", () => {
    expect(readCookie("a=1; localdocs_session=abc; b=2", "localdocs_session")).toBe("abc");
  });

  it("returns undefined when missing or when there is no header", () => {
    expect(readCookie("a=1", "localdocs_session")).toBeUndefined();
    expect(readCookie(undefined, "localdocs_session")).toBeUndefined();
  });

  it("returns undefined for a malformed encoded value", () => {
    expect(readCookie("localdocs_session=%E0%A4%A", "localdocs_session")).toBeUndefined();
  });
});

describe("validation", () => {
  it("normalizes emails", () => {
    expect(normalizeEmail("  Me@Example.COM ")).toBe("me@example.com");
  });

  it("rejects bad emails", () => {
    expect(normalizeEmail("nope")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });

  it("checks name length", () => {
    expect(cleanName("  Ed ")).toBe("Ed");
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("x".repeat(61))).toBeNull();
  });

  it("checks password length", () => {
    expect(passwordProblem("short")).not.toBeNull();
    expect(passwordProblem("long enough password")).toBeNull();
    expect(passwordProblem("x".repeat(129))).not.toBeNull();
    expect(passwordProblem(undefined)).not.toBeNull();
  });
});

describe("rate limiter", () => {
  it("blocks after the limit and recovers after the window", () => {
    const check = createRateLimiter(2, 1000);
    expect(check("ip", 0).allowed).toBe(true);
    expect(check("ip", 100).allowed).toBe(true);

    const blocked = check("ip", 200);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    expect(check("ip", 1500).allowed).toBe(true);
  });

  it("tracks each key separately", () => {
    const check = createRateLimiter(1, 1000);
    expect(check("a", 0).allowed).toBe(true);
    expect(check("b", 0).allowed).toBe(true);
    expect(check("a", 1).allowed).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("allows paths on this site", () => {
    expect(safeNextPath("/documents/abc")).toBe("/documents/abc");
  });

  it("falls back to / for anything else", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/login")).toBe("/");
  });
});

describe("canEdit", () => {
  it("lets owners and editors edit, but not viewers or strangers", () => {
    expect(canEdit("owner")).toBe(true);
    expect(canEdit("editor")).toBe(true);
    expect(canEdit("viewer")).toBe(false);
    expect(canEdit(null)).toBe(false);
  });
});