import type * as Y from "yjs";

export const LOCAL_ORIGIN = Symbol("local-textarea");

type Delta = Y.YTextEvent["delta"];

/** Turn "textarea now says X" into the smallest Yjs insert/delete. */
export function applyTextDiff(ytext: Y.Text, next: string) {
  const doc = ytext.doc;
  if (!doc) return;

  const prev = ytext.toString();
  if (prev === next) return;

  let start = 0;
  const minLength = Math.min(prev.length, next.length);
  while (start < minLength && prev[start] === next[start]) start++;

  let prevEnd = prev.length;
  let nextEnd = next.length;
  while (
    prevEnd > start &&
    nextEnd > start &&
    prev[prevEnd - 1] === next[nextEnd - 1]
  ) {
    prevEnd--;
    nextEnd--;
  }

  doc.transact(() => {
    if (prevEnd > start) ytext.delete(start, prevEnd - start);
    if (nextEnd > start) ytext.insert(start, next.slice(start, nextEnd));
  }, LOCAL_ORIGIN);
}

/** Where does a cursor position end up after a remote edit? */
export function transformIndex(index: number, delta: Delta): number {
  let oldPos = 0;
  let shift = 0;

  for (const op of delta) {
    if (op.retain !== undefined) {
      oldPos += op.retain;
    } else if (op.insert !== undefined) {
      const length = typeof op.insert === "string" ? op.insert.length : 1;
      if (oldPos <= index) shift += length;
    } else if (op.delete !== undefined) {
      if (oldPos < index) shift -= Math.min(op.delete, index - oldPos);
      oldPos += op.delete;
    }
    if (oldPos > index) break;
  }

  return index + shift;
}