"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

type Props = { id: string; title: string };

export default function DeleteDocumentButton({ id, title }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Delete “${title}”? This can't be undone.`)) return;

    setBusy(true);
    const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });

    if (response.ok) {
      router.refresh();
    } else {
      setBusy(false);
      window.alert("Could not delete the document.");
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className={styles.danger}
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}