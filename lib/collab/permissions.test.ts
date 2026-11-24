import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import { isDocumentWrite } from "./permissions";

function syncMessage(write: (encoder: encoding.Encoder) => void) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0); // message type: sync
  write(encoder);
  return encoding.toUint8Array(encoder);
}

describe("isDocumentWrite", () => {
  const doc = new Y.Doc();
  doc.getText("t").insert(0, "hello");

  it("allows sync step 1 (asking for the document)", () => {
    const message = syncMessage((e) => syncProtocol.writeSyncStep1(e, doc));
    expect(isDocumentWrite(message)).toBe(false);
  });

  it("treats sync step 2 as a write", () => {
    const message = syncMessage((e) => syncProtocol.writeSyncStep2(e, doc));
    expect(isDocumentWrite(message)).toBe(true);
  });

  it("treats an update as a write", () => {
    const message = syncMessage((e) =>
      syncProtocol.writeUpdate(e, Y.encodeStateAsUpdate(doc)),
    );
    expect(isDocumentWrite(message)).toBe(true);
  });

  it("allows awareness (presence) messages", () => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 1); // message type: awareness
    encoding.writeVarUint8Array(encoder, new Uint8Array([0]));
    expect(isDocumentWrite(encoding.toUint8Array(encoder))).toBe(false);
  });

  it("treats unreadable messages as writes", () => {
    expect(isDocumentWrite(new Uint8Array([]))).toBe(true);
  });
});