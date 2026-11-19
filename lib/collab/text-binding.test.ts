import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { applyTextDiff, transformIndex } from "./text-binding";

function textWith(value: string) {
  const doc = new Y.Doc();
  const ytext = doc.getText("t");
  ytext.insert(0, value);
  return ytext;
}

describe("applyTextDiff", () => {
  it("inserts in the middle", () => {
    const text = textWith("Hello world");
    applyTextDiff(text, "Hello big world");
    expect(text.toString()).toBe("Hello big world");
  });

  it("deletes a range", () => {
    const text = textWith("Hello big world");
    applyTextDiff(text, "Hello world");
    expect(text.toString()).toBe("Hello world");
  });

  it("replaces a range", () => {
    const text = textWith("Hello world");
    applyTextDiff(text, "Hello there");
    expect(text.toString()).toBe("Hello there");
  });

  it("makes no change when the text is identical", () => {
    const text = textWith("same");
    let updates = 0;
    text.doc?.on("update", () => updates++);
    applyTextDiff(text, "same");
    expect(updates).toBe(0);
  });
});

describe("transformIndex", () => {
  it("shifts a cursor that sits after a remote insert", () => {
    expect(transformIndex(5, [{ retain: 2 }, { insert: "ab" }])).toBe(7);
  });

  it("leaves a cursor that sits before a remote insert", () => {
    expect(transformIndex(1, [{ retain: 2 }, { insert: "ab" }])).toBe(1);
  });

  it("pulls a cursor back after a remote delete before it", () => {
    expect(transformIndex(5, [{ retain: 1 }, { delete: 2 }])).toBe(3);
  });

  it("moves a cursor to the start of a range deleted around it", () => {
    expect(transformIndex(3, [{ retain: 2 }, { delete: 4 }])).toBe(2);
  });
});