"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

export default function NewDocumentButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/documents", { method: "POST" });
      if (!response.ok) throw new Error("Request failed");
      const { document } = await response.json();
      router.push(`/documents/${document.id}`);
    } catch {
      setError("Could not create the document.");
      setBusy(false);
    }
  }

  return (
    <>
      {error && <span role="alert">{error}</span>}
      <button
        type="button"
        onClick={create}
        disabled={busy}
        className={styles.primary}
      >
        {busy ? "Creating…" : "New document"}
      </button>
    </>
  );
}