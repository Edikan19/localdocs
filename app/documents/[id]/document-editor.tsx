"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as Y from "yjs";
import { CollabProvider, type ConnectionStatus } from "@/lib/collab/provider";
import { bindTextControl } from "@/lib/collab/text-binding";

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
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [synced, setSynced] = useState(false);
  const [peers, setPeers] = useState(1);

  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const titleEl = titleRef.current;
    const bodyEl = bodyRef.current;
    if (!titleEl || !bodyEl) return;

    const doc = new Y.Doc();
    const unbindTitle = bindTextControl(doc.getText("title"), titleEl);
    const unbindBody = bindTextControl(doc.getText("content"), bodyEl);

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
      unbindTitle();
      unbindBody();
      provider.destroy();
      doc.destroy();
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
            ref={titleRef}
            className="editor-title"
            type="text"
            maxLength={120}
            disabled={!synced}
            aria-label="Document title"
            placeholder="Untitled document"
          />

          <textarea
            ref={bodyRef}
            className="editor-content"
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