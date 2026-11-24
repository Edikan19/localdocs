"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./auth.module.css";

type AuthFormProps = {
  mode: "login" | "signup";
  next: string;
};

export default function AuthForm({ mode, next }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const payload = Object.fromEntries(new FormData(event.currentTarget));

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) throw new Error(body.error ?? "Something went wrong.");

      router.replace(next);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const otherHref = `${isSignup ? "/login" : "/signup"}?next=${encodeURIComponent(next)}`;

  return (
    <main className={styles.wrapper}>
      <form className={styles.card} onSubmit={onSubmit}>
        <div>
          <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className={styles.hint}>
            {isSignup ? "Start writing together in LocalDocs." : "Sign in to open your documents."}
          </p>
        </div>

        {isSignup && (
          <label className={styles.field}>
            Name
            <input name="name" type="text" autoComplete="name" maxLength={60} required />
          </label>
        )}

        <label className={styles.field}>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>

        <label className={styles.field}>
          Password
          <input
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? 8 : undefined}
            maxLength={128}
            required
          />
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={busy}>
          {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
        </button>

        <p className={styles.switch}>
          {isSignup ? "Already have an account? " : "New here? "}
          <Link href={otherHref}>{isSignup ? "Sign in" : "Create an account"}</Link>
        </p>
      </form>
    </main>
  );
}