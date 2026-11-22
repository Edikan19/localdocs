import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { deleteSession } from "@/lib/auth/session-store";
import { clearSessionCookie } from "@/lib/auth/current-user";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  await clearSessionCookie();
  return new NextResponse(null, { status: 204 });
}