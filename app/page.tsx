
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DocumentItem = {
  id: number;
  title: string;
  updatedAt: string;
  collaborators: number;
  color: string;
};

const initialDocuments: DocumentItem[] = [
  {
    id: 1,
    title: "Project planning",
    updatedAt: "Edited 12 minutes ago",
    collaborators: 3,
    color: "blue",
  },
  {
    id: 2,
    title: "Meeting notes",
    updatedAt: "Edited yesterday",
    collaborators: 2,
    color: "violet",
  },
  {
    id: 3,
    title: "Ideas and research",
    updatedAt: "Edited 2 days ago",
    collaborators: 1,
    color: "amber",
  },
  {
    id: 4,
    title: "Product requirements",
    updatedAt: "Edited 4 days ago",
    collaborators: 4,
    color: "green",
  },
];

export default function Home() {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [search, setSearch] = useState("");

  const filteredDocuments = useMemo(
    () =>
      documents.filter((document) =>
        document.title.toLowerCase().includes(search.toLowerCase()),
      ),
    [documents, search],
  );

  
function createDocument() {
  const newDocumentId = Date.now();

  const newDocument: DocumentItem = {
    id: newDocumentId,
    title: "Untitled document",
    updatedAt: "Just now",
    collaborators: 1,
    color: "blue",
  };

  setDocuments((currentDocuments) => [
    newDocument,
    ...currentDocuments,
  ]);

  router.push(`/documents/${newDocumentId}`);
}


  return (
    <main className="workspace">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="LocalDocs home">
          <span className="brand-mark">L</span>
          <span>localdocs</span>
        </Link>

        <button className="new-document-button" onClick={createDocument}>
          <span aria-hidden="true">＋</span>
          New document
        </button>

        <nav className="navigation" aria-label="Main navigation">
          <p className="nav-label">WORKSPACE</p>
          <a className="nav-item active" href="#documents">
            <span aria-hidden="true">▦</span>
            My documents
          </a>
          <a className="nav-item" href="#recent">
            <span aria-hidden="true">◷</span>
            Recent
          </a>
          <a className="nav-item" href="#shared">
            <span aria-hidden="true">♧</span>
            Shared with me
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="network-status">
            <span className="status-dot" />
            <div>
              <p>Local network</p>
              <span>Workspace ready</span>
            </div>
          </div>
          <p className="sidebar-version">LOCALDOCS · EARLY ACCESS</p>
        </div>
      </aside>

      <section className="main-panel" id="documents">
        <header className="topbar">
          <span className="breadcrumb">Workspace / Documents</span>
          <div className="profile-avatar" aria-label="Your profile">
            E
          </div>
        </header>

        <div className="content">
          <section className="welcome-section">
            <div>
              <p className="eyebrow">YOUR WORKSPACE</p>
              <h1>Your ideas, together.</h1>
              <p className="welcome-description">
                A quiet space to write, think, and work together.
              </p>
            </div>
            <button className="primary-button" onClick={createDocument}>
              <span aria-hidden="true">＋</span>
              New document
            </button>
          </section>

          <section className="quick-stats" aria-label="Workspace overview">
            <div className="stat-card">
              <span className="stat-icon blue-icon" aria-hidden="true">▤</span>
              <div>
                <p className="stat-label">Total documents</p>
                <p className="stat-value">{documents.length}</p>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon green-icon" aria-hidden="true">↗</span>
              <div>
                <p className="stat-label">Workspace</p>
                <p className="stat-value">Private</p>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon violet-icon" aria-hidden="true">◎</span>
              <div>
                <p className="stat-label">Connection</p>
                <p className="stat-value">Local-first</p>
              </div>
            </div>
          </section>

          <section className="documents-section" id="recent">
            <div className="section-heading">
              <div>
                <h2>All documents</h2>
                <p>Your work, organized in one place.</p>
              </div>
              <label className="search-box">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  placeholder="Search documents..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search documents"
                />
                <kbd>/</kbd>
              </label>
            </div>

            <div className="document-list">
              {filteredDocuments.length > 0 ? (
                filteredDocuments.map((document) => (
                  <article className="document-row" key={document.id}>
                    <div className={`document-icon ${document.color}`}>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        aria-hidden="true"
                      >
                        <path d="M6 3.75h8l4 4V20.25H6z" />
                        <path d="M14 3.75v4h4M9 12h6M9 15.5h6" />
                      </svg>
                    </div>
                    <div className="document-details">
                      <h3>{document.title}</h3>
                      <p>{document.updatedAt}</p>
                    </div>
                    <div className="collaborator-count" title="Collaborators">
                      <span aria-hidden="true">♧</span>
                      {document.collaborators}
                    </div>
                    <span className="document-badge">
                      {document.collaborators > 1 ? "Shared" : "Private"}
                    </span>
                    <button
                      className="more-button"
                      aria-label={`More options for ${document.title}`}
                      title="More options coming soon"
                      disabled
                    >
                      ···
                    </button>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <span aria-hidden="true">⌕</span>
                  <h3>No documents found</h3>
                  <p>Try another search, or create a new document.</p>
                  <button className="text-button" onClick={createDocument}>
                    Create a document
                  </button>
                </div>
              )}
            </div>

            <p className="list-footer">
              Showing {filteredDocuments.length} of {documents.length} documents
            </p>
          </section>

          <footer className="page-footer">
            <span>Made for focused work.</span>
            <span>LocalDocs · Your space, your data.</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
