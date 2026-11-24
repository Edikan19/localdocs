"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Y from "yjs";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { CollabProvider, type ConnectionStatus } from "@/lib/collab/provider";
import { bindTextControl } from "@/lib/collab/text-binding";
import { canEdit, type DocumentRole } from "@/lib/auth/roles";
import ShareDialog from "./share-dialog";

type DocumentEditorProps = {
  documentId: string;
  role: DocumentRole;
  userName: string;
};

type Session = {
  doc: Y.Doc;
  provider: CollabProvider;
  user: { name: string; color: string };
};

const CURSOR_COLORS = [
  "#e11d48",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#c026d3",
];

function statusLabel(status: ConnectionStatus, synced: boolean, peers: number) {
  if (status === "unauthorized") return "Signed out. Redirecting…";
  if (status === "not-found") return "Document not found";
  if (status === "disconnected") return "Offline: changes will sync when reconnected";
  if (status === "connected" && synced) {
    return peers > 1 ? `Live · ${peers} people editing` : "Live · just you";
  }
  return "Connecting…";
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      h1: editor.isActive("heading", { level: 1 }),
      h2: editor.isActive("heading", { level: 2 }),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      editable: editor.isEditable,
    }),
  });

  const buttons = [
    { label: "B", title: "Bold", active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { label: "I", title: "Italic", active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { label: "H1", title: "Heading 1", active: state.h1, run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: "H2", title: "Heading 2", active: state.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "• List", title: "Bulleted list", active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "1. List", title: "Numbered list", active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Undo", title: "Undo", active: false, run: () => editor.chain().focus().undo().run() },
    { label: "Redo", title: "Redo", active: false, run: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div className="rich-toolbar" role="toolbar" aria-label="Formatting">
      {buttons.map((button) => (
        <button
          key={button.title}
          type="button"
          title={button.title}
          aria-pressed={button.active}
          data-active={button.active}
          disabled={!state.editable}
          onClick={button.run}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}

function RichEditor({ session, editable }: { session: Session; editable: boolean }) {
  const editor = useEditor(
    {
      immediatelyRender: false, // avoids a hydration mismatch in Next.js
      editable: false,
      extensions: [
        // Collaboration brings its own undo/redo that only undoes *your* edits
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: session.doc, field: "body" }),
        CollaborationCaret.configure({
          provider: session.provider,
          user: session.user,
        }),
      ],
      editorProps: {
        attributes: { "aria-label": "Document content", spellcheck: "true" },
      },
    },
    [session],
  );

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  return (
    <>
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="rich-editor" />
    </>
  );
}

export default function DocumentEditor({
  documentId,
  role,
  userName,
}: DocumentEditorProps) {
  const router = useRouter();

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [synced, setSynced] = useState(false);
  const [peers, setPeers] = useState(1);
  const [session, setSession] = useState<Session | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);

  // Viewers get a read-only editor. The server also drops their edits.
  const canWrite = canEdit(role);

  useEffect(() => {
    const titleEl = titleRef.current;
    if (!titleEl) return;

    const doc = new Y.Doc();
    const unbindTitle = bindTextControl(doc.getText("title"), titleEl);

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const provider = new CollabProvider(
      `${protocol}://${window.location.host}/ws/${documentId}`,
      doc,
      { onStatus: setStatus, onSynced: () => setSynced(true) },
    );

    const user = {
      name: userName,
      color: CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)],
    };
    provider.awareness.setLocalStateField("user", user);

    const updatePeers = () => setPeers(provider.awareness.getStates().size);
    provider.awareness.on("change", updatePeers);
    updatePeers();

    setSession({ doc, provider, user });

    return () => {
      setSession(null); // unmount the editor before its document goes away
      unbindTitle();
      provider.destroy();
      doc.destroy();
    };
  }, [documentId, userName]);

  // The login expired or was removed: go back to the login page
  useEffect(() => {
    if (status === "unauthorized") {
      router.replace(
        `/login?next=${encodeURIComponent(`/documents/${documentId}`)}`,
      );
    }
  }, [status, router, documentId]);

  return (
    <main className="editor-page">
      <header className="editor-header">
        <Link href="/" className="editor-brand">
          LocalDocs
        </Link>

        <div className="editor-header-actions">
          {!canWrite && <span className="editor-save-status">View only</span>}

          <span className="editor-save-status">
            {statusLabel(status, synced, peers)}
          </span>

          {role === "owner" && <ShareDialog documentId={documentId} />}

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
            disabled={!synced || !canWrite}
            aria-label="Document title"
            placeholder="Untitled document"
          />

          {session && <RichEditor session={session} editable={synced && canWrite} />}
        </div>
      </section>
    </main>
  );
}