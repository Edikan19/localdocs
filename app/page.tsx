
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DocumentItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type DocumentsResponse = {
  documents?: DocumentItem[];
  error?: string;
};

type CreateDocumentResponse = {
  document?: DocumentItem;
  error?: string;
};

function formatUpdatedAt(value: string) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "Recently edited";
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000),
  );

  if (elapsedSeconds < 60) {
    return "Edited just now";
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  if (elapsedMinutes < 60) {
    return `Edited ${elapsedMinutes} minute${elapsedMinutes === 1 ? "" : "s"} ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `Edited ${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 7) {
    return `Edited ${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
  }

  return `Edited ${new Date(value).toLocaleDateString()}`;
}

export default function Home() {
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDocuments() {
      try {
        const response = await fetch("/api/documents", {
          cache: "no-store",
          signal: controller.signal,
        });

        const payload =
          (await response.json()) as DocumentsResponse;

        if (!response.ok || !Array.isArray(payload.documents)) {
          throw new Error(
            payload.error ?? "Unable to load your documents.",
          );
        }

        setDocuments(payload.documents);
        setLoadError(null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load your documents.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDocuments();

    return () => controller.abort();
  }, [reloadKey]);

  const filteredDocuments = useMemo(
    () =>
      documents.filter((document) =>
        document.title.toLowerCase().includes(search.toLowerCase()),
      ),
    [documents, search],
  );

  const createDocument = useCallback(async () => {
    if (isCreating) {
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Untitled document",
        }),
      });

      const payload =
        (await response.json()) as CreateDocumentResponse;

      if (!response.ok || !payload.document) {
        throw new Error(
          payload.error ?? "Unable to create your document.",
        );
      }

      router.push(`/documents/${payload.document.id}`);
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Unable to create your document.",
      );
      setIsCreating(false);
    }
  }, [isCreating, router]);

  return (
    <main className="workspace">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="LocalDocs home">
          <span className="brand-mark">L</span>
          <span>localdocs</span>
        </Link>

        <button
          className="new-document-button"
          onClick={createDocument}
          disabled={isCreating}
        >
          <span aria-hidden="true">＋</span>
          {isCreating ? "Creating..." : "New document"}
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
            <button
              className="primary-button"
              onClick={createDocument}
              disabled={isCreating}
            >
              <span aria-hidden="true">＋</span>
              {isCreating ? "Creating..." : "New document"}
            </button>
          </section>

          {createError && (
            <p role="alert">
              {createError}
            </p>
          )}

          <section className="quick-stats" aria-label="Workspace overview">
            <div className="stat-card">
              <span className="stat-icon blue-icon" aria-hidden="true">
                ▤
              </span>
              <div>
                <p className="stat-label">Total documents</p>
                <p className="stat-value">
                  {loading ? "—" : documents.length}
                </p>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon green-icon" aria-hidden="true">
                ↗
              </span>
              <div>
                <p className="stat-label">Workspace</p>
                <p className="stat-value">Private</p>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon violet-icon" aria-hidden="true">
                ◎
              </span>
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
              {loading ? (
                <div className="empty-state" role="status">
                  <h3>Loading documents...</h3>
                  <p>Fetching your saved documents.</p>
                </div>
              ) : loadError ? (
                <div className="empty-state" role="alert">
                  <h3>Couldn&apos;t load documents</h3>
                  <p>{loadError}</p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setLoading(true);
                      setReloadKey((current) => current + 1);
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : filteredDocuments.length > 0 ? (
                filteredDocuments.map((document) => (
                  <article className="document-row" key={document.id}>
                    <div className="document-icon blue">
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
                      <p>{formatUpdatedAt(document.updatedAt)}</p>
                    </div>
                    <span className="document-badge">Local</span>
                    <Link
                      className="more-button"
                      href={`/documents/${document.id}`}
                      aria-label={`Open ${document.title}`}
                      title={`Open ${document.title}`}
                    >
                      →
                    </Link>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <span aria-hidden="true">⌕</span>
                  <h3>
                    {search ? "No documents found" : "No documents yet"}
                  </h3>
                  <p>
                    {search
                      ? "Try another search, or create a new document."
                      : "Create your first document to get started."}
                  </p>
                  <button
                    className="text-button"
                    onClick={createDocument}
                    disabled={isCreating}
                  >
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
