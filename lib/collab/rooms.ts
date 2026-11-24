import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import type { WebSocket } from "ws";
import { prisma } from "../prisma";
import { fragmentToText, textToParagraphs } from "./doc-text";
import { isDocumentWrite } from "./permissions";
import { readCookie, SESSION_COOKIE } from "../auth/cookies";
import { getUserBySessionToken } from "../auth/session-store";
import { getDocumentRole } from "../auth/access";
import { canEdit } from "../auth/roles";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const SAVE_INTERVAL_MS = 2000;
// Every 30 seconds each connection is pinged and its access is re-checked
const HEARTBEAT_MS = 30_000;

type Connection = {
  awarenessIds: Set<number>; // awareness client ids this connection controls
  canWrite: boolean;
};

class Room {
  readonly doc = new Y.Doc();
  readonly awareness = new awarenessProtocol.Awareness(this.doc);
  readonly conns = new Map<WebSocket, Connection>();
  destroyed = false;

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private saving: Promise<void> = Promise.resolve();

  constructor(readonly id: string) {
    this.awareness.setLocalState(null); // the server isn't a participant
    this.doc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);
  }

  /** Load saved state from SQLite. Returns false if the document doesn't exist. */
  async load(): Promise<boolean> {
    const row = await prisma.document.findUnique({
      where: { id: this.id },
      select: { state: true, content: true, title: true },
    });
    if (!row) return false;

    if (row.state) {
      Y.applyUpdate(this.doc, row.state, "db");
    }

    // Documents from before rich text kept plain text in "content"; carry it over once
    const body = this.doc.getXmlFragment("body");
    if (body.length === 0) {
      const legacy = this.doc.getText("content").toString() || row.content;
      if (legacy) body.insert(0, textToParagraphs(legacy));
    }

    // Documents saved before titles lived in Yjs have no title text yet
    const title = this.doc.getText("title");
    if (title.length === 0 && row.title) title.insert(0, row.title);

    return true;
  }

  addConnection(ws: WebSocket, canWrite: boolean) {
    this.conns.set(ws, { awarenessIds: new Set(), canWrite });

    // Ask the client for what we're missing (sync step 1)
    const sync = encoding.createEncoder();
    encoding.writeVarUint(sync, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(sync, this.doc);
    ws.send(encoding.toUint8Array(sync));

    // Tell the newcomer who else is here
    const states = this.awareness.getStates();
    if (states.size > 0) {
      const aw = encoding.createEncoder();
      encoding.writeVarUint(aw, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        aw,
        awarenessProtocol.encodeAwarenessUpdate(
          this.awareness,
          Array.from(states.keys()),
        ),
      );
      ws.send(encoding.toUint8Array(aw));
    }
  }

  setCanWrite(ws: WebSocket, canWrite: boolean) {
    const connection = this.conns.get(ws);
    if (connection) connection.canWrite = canWrite;
  }

  removeConnection(ws: WebSocket) {
    const connection = this.conns.get(ws);
    this.conns.delete(ws);
    if (connection) {
      // Removes this user's cursor/presence for everyone else
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        Array.from(connection.awarenessIds),
        null,
      );
    }
  }

  handleMessage(ws: WebSocket, message: Uint8Array) {
    const connection = this.conns.get(ws);
    if (!connection) return;

    // Read-only users may ask for the document but can't change it
    if (!connection.canWrite && isDocumentWrite(message)) return;

    try {
      const decoder = decoding.createDecoder(message);
      const type = decoding.readVarUint(decoder);

      if (type === MESSAGE_SYNC) {
        const reply = encoding.createEncoder();
        encoding.writeVarUint(reply, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, reply, this.doc, ws);
        // Only reply if the protocol produced something beyond the header
        if (encoding.length(reply) > 1) {
          ws.send(encoding.toUint8Array(reply));
        }
      } else if (type === MESSAGE_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(
          this.awareness,
          decoding.readVarUint8Array(decoder),
          ws,
        );
      }
    } catch (error) {
      console.error(`[room ${this.id}] bad message:`, error);
    }
  }

  /** Save now (also cancels any pending timed save). */
  flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    // Chain saves so two never overlap
    this.saving = this.saving.then(async () => {
      if (!this.dirty) return;
      this.dirty = false;
      try {
        await this.persist();
      } catch (error) {
        if ((error as { code?: string }).code === "P2025") {
          // Prisma: record not found, so the document was deleted while open
          this.closeAll(4404, "Document deleted");
        } else {
          this.dirty = true;
          console.error(`[room ${this.id}] save failed:`, error);
        }
      }
    });
    return this.saving;
  }

  destroy() {
    this.destroyed = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.awareness.destroy(); // clears its internal interval
    this.doc.destroy();
  }

  private async persist() {
    await prisma.document.update({
      where: { id: this.id },
      data: {
        state: Buffer.from(Y.encodeStateAsUpdate(this.doc)),
        // Plain-text copy for previews and search
        content: fragmentToText(this.doc.getXmlFragment("body")),
        title:
          this.doc.getText("title").toString().trim().slice(0, 120) ||
          "Untitled document",
      },
    });
  }

  private scheduleSave() {
    this.dirty = true;
    if (this.saveTimer) return; // at most one save per interval, even while typing
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, SAVE_INTERVAL_MS);
  }

  private broadcast(message: Uint8Array) {
    for (const ws of this.conns.keys()) {
      if (ws.readyState === ws.OPEN) ws.send(message);
    }
  }

  private closeAll(code: number, reason: string) {
    for (const ws of this.conns.keys()) ws.close(code, reason);
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    syncProtocol.writeUpdate(enc, update);
    this.broadcast(encoding.toUint8Array(enc));

    if (origin !== "db") this.scheduleSave(); // don't re-save what we just loaded
  };

  private onAwarenessUpdate = (
    {
      added,
      updated,
      removed,
    }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    const owned = this.conns.get(origin as WebSocket)?.awarenessIds;
    if (owned) {
      added.forEach((id) => owned.add(id));
      removed.forEach((id) => owned.delete(id));
    }

    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      enc,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
        ...added,
        ...updated,
        ...removed,
      ]),
    );
    this.broadcast(encoding.toUint8Array(enc));
  };
}

// --- Room registry -------------------------------------------------------

// Stores promises so two clients opening the same document at once share one load
const rooms = new Map<string, Promise<Room | null>>();

function getRoom(id: string): Promise<Room | null> {
  let pending = rooms.get(id);
  if (!pending) {
    pending = loadRoom(id);
    rooms.set(id, pending);
  }
  return pending;
}

async function loadRoom(id: string): Promise<Room | null> {
  const room = new Room(id);
  try {
    if (await room.load()) return room;
  } catch (error) {
    rooms.delete(id);
    room.destroy();
    throw error;
  }
  rooms.delete(id);
  room.destroy();
  return null;
}

async function releaseIfEmpty(room: Room) {
  if (room.conns.size > 0) return;
  await room.flush();
  if (room.conns.size > 0) return; // someone joined while we were saving
  rooms.delete(room.id);
  room.destroy();
}

export async function flushAllRooms() {
  const loaded = await Promise.all(rooms.values());
  await Promise.all(loaded.map((room) => room?.flush()));
}

// --- Connection entry point (called by server.ts) ------------------------

export async function handleConnection(
  ws: WebSocket,
  docId: string,
  cookieHeader: string | undefined,
) {
  // Messages can arrive while we check the login and load the room, so queue them
  const queued: Uint8Array[] = [];
  let room: Room | null = null;
  let userId: string | null = null;
  const token = readCookie(cookieHeader, SESSION_COOKIE);

  // Runs every 30 seconds: removing someone's access, or signing out,
  // takes effect on connections that are already open
  async function recheckAccess() {
    const current = room;
    const uid = userId;
    if (!current || !uid) return;

    try {
      if (!(await getUserBySessionToken(token))) {
        ws.close(4401, "Signed out");
        return;
      }
      const role = await getDocumentRole(uid, docId);
      if (!role) {
        ws.close(4404, "Access removed");
        return;
      }
      current.setCanWrite(ws, canEdit(role)); // picks up editor <-> viewer changes
    } catch (error) {
      console.error(`[ws ${docId}] access re-check failed:`, error);
    }
  }

  // Heartbeat: drop connections that stop answering pings
  // (for example a phone that lost Wi-Fi without closing the socket)
  let alive = true;
  ws.on("pong", () => {
    alive = true;
  });
  const heartbeat = setInterval(() => {
    if (!alive) {
      ws.terminate(); // fires "close", which cleans up the room and presence
      return;
    }
    alive = false;
    ws.ping();
    void recheckAccess();
  }, HEARTBEAT_MS);

  ws.on("message", (data, isBinary) => {
    if (!isBinary) return;
    const buf = data as Buffer;
    const message = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    if (room) room.handleMessage(ws, message);
    else queued.push(message);
  });

  ws.on("error", (error) => console.error(`[ws ${docId}]`, error));

  ws.on("close", () => {
    clearInterval(heartbeat);
    if (!room) return;
    room.removeConnection(ws);
    console.log(`[room ${docId}] client left (${room.conns.size} connected)`);
    void releaseIfEmpty(room);
  });

  try {
    const user = await getUserBySessionToken(token);
    if (!user) {
      ws.close(4401, "Not signed in");
      return;
    }

    // "No access" and "doesn't exist" look the same, so ids can't be probed
    const role = await getDocumentRole(user.id, docId);
    if (!role) {
      ws.close(4404, "Document not found");
      return;
    }
    userId = user.id;

    let loaded: Room | null;
    do {
      loaded = await getRoom(docId);
    } while (loaded?.destroyed); // room was torn down just as we arrived; get a fresh one

    if (!loaded) {
      ws.close(4404, "Document not found");
      return;
    }
    if (ws.readyState !== ws.OPEN) {
      void releaseIfEmpty(loaded); // client left while we were loading
      return;
    }

    room = loaded;
    room.addConnection(ws, canEdit(role));
    console.log(`[room ${docId}] client joined (${room.conns.size} connected)`);
    for (const message of queued) room.handleMessage(ws, message);
    queued.length = 0;
  } catch (error) {
    console.error(`[room ${docId}] failed to open:`, error);
    ws.close(1011, "Server error");
  }
}