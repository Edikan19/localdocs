"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as Y from "yjs";
import { CollabProvider, type ConnectionStatus } from "@/lib/collab/provider";
import {
  LOCAL_ORIGIN,
  applyTextDiff,
  transformIndex,
} from "@/lib/collab/text-binding";

type DocumentEditorProps = {
  documentId: string;
};

function statusLabel(status: ConnectionStatus, synced: boolean, peers: number) {
  if (status === "not-found") return "Document not found";
  if (status === "disconnected") return "Offline: changes will sync when reconnected";
  if (status === "connected" && synced) {
    return peers > 1 ? `Live · ${peers} people editing` : "Live · just you";
  }
  return "Connecting…";
}

export default function DocumentEditor({ documentId }: DocumentEditorProps) {
  const [title, setTitle] = useState("Untitled document");
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [synced, setSynced] = useState(false);
  const [peers, setPeers] = useState(1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ytextRef = useRef<Y.Text | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.value = "";

    const doc = new Y.Doc();
    const ytext = doc.getText("content");
    ytextRef.current = ytext;

    // Remote edits: update the textarea but keep the cursor where it was
    const observer = (event: Y.YTextEvent) => {
      if (event.transaction.origin === LOCAL_ORIGIN) return;
      const { selectionStart, selectionEnd, scrollTop } = textarea;
      textarea.value = ytext.toString();
      textarea.setSelectionRange(
        transformIndex(selectionStart, event.delta),
        transformIndex(selectionEnd, event.delta),
      );
      textarea.scrollTop = scrollTop;
    };
    ytext.observe(observer);

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const provider = new CollabProvider(
      `${protocol}://${window.location.host}/ws/${documentId}`,
      doc,
      { onStatus: setStatus, onSynced: () => setSynced(true) },
    );

    provider.awareness.setLocalStateField("user", {
      name: `Guest ${Math.floor(1000 + Math.random() * 9000)}`,
    });
    const updatePeers = () => setPeers(provider.awareness.getStates().size);
    provider.awareness.on("change", updatePeers);
    updatePeers();

    return () => {
      ytext.unobserve(observer);
      provider.destroy();
      doc.destroy();
      ytextRef.current = null;
    };
  }, [documentId]);

  return (
    <main className="editor-page">
      <header className="editor-header">
        <Link href="/" className="editor-brand">
          LocalDocs
        </Link>

        <div className="editor-header-actions">
          <span className="editor-save-status">
            {statusLabel(status, synced, peers)}
          </span>

          <Link href="/" className="editor-back-link">
            Back to dashboard
          </Link>
        </div>
      </header>

      <section className="editor-workspace">
        <div className="editor-toolbar">
          <span className="editor-document-id">Document ID: {documentId}</span>
        </div>

        <div className="editor-paper">
          <input
            className="editor-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Document title"
            placeholder="Untitled document"
          />

          <textarea
            ref={textareaRef}
            className="editor-content"
            onChange={(event) => {
              const ytext = ytextRef.current;
              if (ytext) applyTextDiff(ytext, event.target.value);
            }}
            disabled={!synced}
            aria-label="Document content"
            placeholder={synced ? "Start writing your document..." : ""}
            spellCheck
          />
        </div>
      </section>
    </main>
  );
}