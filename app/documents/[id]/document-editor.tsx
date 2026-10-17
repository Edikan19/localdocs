
"use client";

import { useState } from "react";
import Link from "next/link";

type DocumentEditorProps = {
  documentId: string;
};

export default function DocumentEditor({
  documentId,
}: DocumentEditorProps) {
  const [title, setTitle] = useState("Untitled document");
  const [content, setContent] = useState("");

  return (
    <main className="editor-page">
      <header className="editor-header">
        <Link href="/" className="editor-brand">
          LocalDocs
        </Link>

        <div className="editor-header-actions">
          <span className="editor-save-status">
            Changes are local only
          </span>

          <Link href="/" className="editor-back-link">
            Back to dashboard
          </Link>
        </div>
      </header>

      <section className="editor-workspace">
        <div className="editor-toolbar">
          <span className="editor-document-id">
            Document ID: {documentId}
          </span>
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
            className="editor-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            aria-label="Document content"
            placeholder="Start writing your document..."
            spellCheck
          />
        </div>
      </section>
    </main>
  );
}
