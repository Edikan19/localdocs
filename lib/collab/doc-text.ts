import * as Y from "yjs";

/** Plain text -> one paragraph per line, in the shape TipTap expects. */
export function textToParagraphs(text: string): Y.XmlElement[] {
  return text.split("\n").map((line) => {
    const paragraph = new Y.XmlElement("paragraph");
    if (line) paragraph.insert(0, [new Y.XmlText(line)]);
    return paragraph;
  });
}

/** Rich-text fragment -> plain text, for previews and search. */
export function fragmentToText(fragment: Y.XmlFragment): string {
  const walk = (node: Y.XmlFragment): string => {
    let out = "";
    for (const child of node.toArray()) {
      if (child instanceof Y.XmlText) {
        out += child
          .toDelta()
          .map((op: { insert?: unknown }) =>
            typeof op.insert === "string" ? op.insert : "",
          )
          .join("");
      } else if (child instanceof Y.XmlElement) {
        out += walk(child) + "\n";
      }
    }
    return out;
  };

  return walk(fragment).replace(/\n+/g, "\n").trim();
}