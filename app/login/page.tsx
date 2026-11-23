import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/validation";
import AuthForm from "../auth-form";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const next = safeNextPath((await searchParams).next);

  // Already signed in (a real check, not just a cookie): skip the form
  if (await getCurrentUser()) redirect(next);

  return <AuthForm mode="login" next={next} />;
}