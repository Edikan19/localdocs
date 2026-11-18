import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MAX_BACKOFF_MS = 5000;

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "not-found";

type Callbacks = {
  onStatus?: (status: ConnectionStatus) => void;
  onSynced?: () => void;
};

export class CollabProvider {
  readonly awareness: awarenessProtocol.Awareness;

  private ws: WebSocket | null = null;
  private retries = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private synced = false;

  constructor(
    private readonly url: string,
    readonly doc: Y.Doc,
    private readonly callbacks: Callbacks = {},
  ) {
    this.awareness = new awarenessProtocol.Awareness(doc);
    doc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);
    this.connect();
  }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    // Tell everyone else we left before the socket closes
    awarenessProtocol.removeAwarenessStates(
      this.awareness,
      [this.doc.clientID],
      "destroy",
    );
    this.doc.off("update", this.onDocUpdate);
    this.awareness.destroy();
    this.ws?.close();
    this.ws = null;
  }

  private connect() {
    if (this.destroyed) return;
    this.callbacks.onStatus?.("connecting");

    const ws = new WebSocket(this.url);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      this.retries = 0;
      this.callbacks.onStatus?.("connected");

      // Ask the server for anything we're missing
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(enc, this.doc);
      ws.send(encoding.toUint8Array(enc));

      if (this.awareness.getLocalState() !== null) {
        this.sendAwareness([this.doc.clientID]);
      }
    };

    ws.onmessage = (event) => {
      try {
        const decoder = decoding.createDecoder(
          new Uint8Array(event.data as ArrayBuffer),
        );
        const type = decoding.readVarUint(decoder);

        if (type === MESSAGE_SYNC) {
          const reply = encoding.createEncoder();
          encoding.writeVarUint(reply, MESSAGE_SYNC);
          // `this` as origin lets onDocUpdate know not to echo this back
          const syncType = syncProtocol.readSyncMessage(
            decoder,
            reply,
            this.doc,
            this,
          );
          if (syncType === syncProtocol.messageYjsSyncStep2 && !this.synced) {
            this.synced = true;
            this.callbacks.onSynced?.();
          }
          if (encoding.length(reply) > 1) ws.send(encoding.toUint8Array(reply));
        } else if (type === MESSAGE_AWARENESS) {
          awarenessProtocol.applyAwarenessUpdate(
            this.awareness,
            decoding.readVarUint8Array(decoder),
            this,
          );
        }
      } catch (error) {
        console.error("Bad message from server:", error);
      }
    };

    ws.onclose = (event) => {
      if (this.ws === ws) this.ws = null;
      if (this.destroyed) return;

      // Forget everyone else's presence; the server resends it on reconnect
      const others = Array.from(this.awareness.getStates().keys()).filter(
        (id) => id !== this.doc.clientID,
      );
      awarenessProtocol.removeAwarenessStates(this.awareness, others, this);

      if (event.code === 4404) {
        this.callbacks.onStatus?.("not-found");
        return; // no point retrying a document that doesn't exist
      }

      this.callbacks.onStatus?.("disconnected");
      const delay = Math.min(MAX_BACKOFF_MS, 250 * 2 ** this.retries++);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
  }

  private send(message: Uint8Array) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(message);
  }

  private sendAwareness(clients: number[]) {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      enc,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, clients),
    );
    this.send(encoding.toUint8Array(enc));
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return; // it came from the server, don't echo it
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    syncProtocol.writeUpdate(enc, update);
    this.send(encoding.toUint8Array(enc));
  };

  private onAwarenessUpdate = (
    {
      added,
      updated,
      removed,
    }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === this) return;
    this.sendAwareness([...added, ...updated, ...removed]);
  };
}