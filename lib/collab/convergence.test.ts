import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { applyTextDiff } from "./text-binding";

/** Run the sync handshake in both directions between two docs. */
function syncDocs(a: Y.Doc, b: Y.Doc) {
  for (const [from, to] of [[a, b], [b, a]] as const) {
    const step1 = encoding.createEncoder();
    syncProtocol.writeSyncStep1(step1, from);

    const step2 = encoding.createEncoder();
    syncProtocol.readSyncMessage(
      decoding.createDecoder(encoding.toUint8Array(step1)),
      step2,
      to,
      "test",
    );
    syncProtocol.readSyncMessage(
      decoding.createDecoder(encoding.toUint8Array(step2)),
      encoding.createEncoder(),
      from,
      "test",
    );
  }
}

function makePeer() {
  const doc = new Y.Doc();
  return { doc, text: doc.getText("content") };
}

describe("document convergence", () => {
  it("keeps both edits when two people type at the same spot", () => {
    const a = makePeer();
    const b = makePeer();
    applyTextDiff(a.text, "Hello");
    syncDocs(a.doc, b.doc);

    applyTextDiff(a.text, "Hello there");
    applyTextDiff(b.text, "Hello world");
    syncDocs(a.doc, b.doc);

    expect(a.text.toString()).toBe(b.text.toString());
    expect(a.text.toString()).toContain("there");
    expect(a.text.toString()).toContain("world");
  });

  it("merges edits made while one side was offline", () => {
    const a = makePeer();
    const b = makePeer();
    applyTextDiff(a.text, "Hello world");
    syncDocs(a.doc, b.doc);

    applyTextDiff(a.text, "Oh, Hello world"); // edit at the start
    applyTextDiff(b.text, "Hello world!!"); // edit at the end
    syncDocs(a.doc, b.doc);

    expect(a.text.toString()).toBe("Oh, Hello world!!");
    expect(b.text.toString()).toBe("Oh, Hello world!!");
  });

  it("converges when a delete races an insert inside the deleted range", () => {
    const a = makePeer();
    const b = makePeer();
    applyTextDiff(a.text, "abcdef");
    syncDocs(a.doc, b.doc);

    applyTextDiff(a.text, "abef"); // deletes "cd"
    applyTextDiff(b.text, "abcXdef"); // inserts X between c and d
    syncDocs(a.doc, b.doc);

    expect(a.text.toString()).toBe(b.text.toString());
    expect(a.text.toString()).toContain("X");
  });
});