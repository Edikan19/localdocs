import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/validation";
import AuthForm from "../auth-form";
import styles from "../auth.module.css";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignupPage({ searchParams }: Props) {
  const next = safeNextPath((await searchParams).next);

  if (await getCurrentUser()) redirect(next);

  if (process.env.ALLOW_SIGNUP === "false") {
    return (
      <main className={styles.wrapper}>
        <div className={styles.card}>
          <h1>Sign-ups are closed</h1>
          <p className={styles.hint}>Ask the owner of this workspace for an account.</p>
          <p className={styles.switch}>
            <Link href="/login">Back to sign in</Link>
          </p>
        </div>
      </main>
    );
  }

  return <AuthForm mode="signup" next={next} />;
}