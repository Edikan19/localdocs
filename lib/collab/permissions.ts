import * as syncProtocol from "y-protocols/sync";
import * as decoding from "lib0/decoding";

const MESSAGE_SYNC = 0;

/**
 * True if a message would change the document, as opposed to asking for it
 * (sync step 1) or sharing presence. Read-only connections may not send these.
 */
export function isDocumentWrite(message: Uint8Array): boolean {
  try {
    const decoder = decoding.createDecoder(message);
    if (decoding.readVarUint(decoder) !== MESSAGE_SYNC) return false;

    const syncType = decoding.readVarUint(decoder);
    return (
      syncType === syncProtocol.messageYjsSyncStep2 ||
      syncType === syncProtocol.messageYjsUpdate
    );
  } catch {
    return true; // unreadable: treat it as a write, so read-only users can't sneak it through
  }
}