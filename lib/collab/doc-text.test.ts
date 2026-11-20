import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { fragmentToText, textToParagraphs } from "./doc-text";

describe("doc-text", () => {
  it("turns text into paragraphs and back", () => {
    const doc = new Y.Doc();
    const body = doc.getXmlFragment("body");
    body.insert(0, textToParagraphs("First line\nSecond line"));

    expect(body.length).toBe(2);
    expect(fragmentToText(body)).toBe("First line\nSecond line");
  });

  it("reads text out of nested elements like lists", () => {
    const doc = new Y.Doc();
    const body = doc.getXmlFragment("body");

    const item = new Y.XmlElement("listItem");
    item.insert(0, textToParagraphs("Nested item"));
    const list = new Y.XmlElement("bulletList");
    list.insert(0, [item]);
    body.insert(0, [list]);

    expect(fragmentToText(body)).toBe("Nested item");
  });
});