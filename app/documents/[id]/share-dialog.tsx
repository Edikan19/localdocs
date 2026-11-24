"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import styles from "./share-dialog.module.css";

type Role = "editor" | "viewer";
type Person = { name: string; email: string };
type Member = Person & { userId: string; role: Role };
type MembersResponse = { owner?: Person; members?: Member[]; error?: string };

export default function ShareDialog({ documentId }: { documentId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [owner, setOwner] = useState<Person | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const base = `/api/documents/${documentId}/members`;

  const load = useCallback(async () => {
    const response = await fetch(base, { cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as MembersResponse;

    if (!response.ok) {
      setError(body.error ?? "Unable to load sharing settings.");
      return;
    }
    setOwner(body.owner ?? null);
    setMembers(body.members ?? []);
    setError(null);
  }, [base]);

  function open() {
    dialogRef.current?.showModal();
    void load();
  }

  function close() {
    dialogRef.current?.close();
  }

  async function run(action: () => Promise<Response>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const response = await action();
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Something went wrong.");
        return false;
      }
      await load();
      return true;
    } catch {
      setError("Network error. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget; // read before any await
    const payload = Object.fromEntries(new FormData(form));

    const ok = await run(() =>
      fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
    if (ok) form.reset();
  }

  const changeRole = (member: Member, role: Role) =>
    run(() =>
      fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: member.email, role }),
      }),
    );

  const removeMember = (member: Member) =>
    run(() => fetch(`${base}/${member.userId}`, { method: "DELETE" }));

  return (
    <>
      <button type="button" className="text-button" onClick={open}>
        Share
      </button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        onClick={(event) => {
          if (event.target === event.currentTarget) close(); // click on the backdrop
        }}
      >
        <div className={styles.body}>
          <header className={styles.header}>
            <h2>Share this document</h2>
            <button type="button" onClick={close} aria-label="Close">
              ✕
            </button>
          </header>

          <form className={styles.add} onSubmit={addMember}>
            <input
              name="email"
              type="email"
              placeholder="Email of an existing account"
              required
            />
            <select name="role" defaultValue="editor" aria-label="Permission">
              <option value="editor">Can edit</option>
              <option value="viewer">Can view</option>
            </select>
            <button type="submit" disabled={busy}>
              Add
            </button>
          </form>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <ul className={styles.people}>
            {owner && (
              <li>
                <span className={styles.person}>
                  <strong>{owner.name}</strong>
                  <small>{owner.email}</small>
                </span>
                <span className={styles.tag}>Owner</span>
              </li>
            )}

            {members.map((member) => (
              <li key={member.userId}>
                <span className={styles.person}>
                  <strong>{member.name}</strong>
                  <small>{member.email}</small>
                </span>
                <span className={styles.controls}>
                  <select
                    value={member.role}
                    disabled={busy}
                    aria-label={`Permission for ${member.name}`}
                    onChange={(event) => changeRole(member, event.target.value as Role)}
                  >
                    <option value="editor">Can edit</option>
                    <option value="viewer">Can view</option>
                  </select>
                  <button
                    type="button"
                    className={styles.remove}
                    disabled={busy}
                    onClick={() => removeMember(member)}
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>

          {members.length === 0 && (
            <p className={styles.hint}>Not shared with anyone yet.</p>
          )}
        </div>
      </dialog>
    </>
  );
}